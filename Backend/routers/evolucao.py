import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from auth import exigir_nutricionista, exigir_paciente
from database import get_db_connection
from schemas.checkin_schema import AnaliseCheckin
from services import consentimento, openai_service, prompts

router = APIRouter(tags=["evolucao"])


class PerfilInicialRequest(BaseModel):
    nome: Optional[str] = None
    idade: Optional[float] = Field(None, ge=0, le=120)
    peso: Optional[float] = Field(None, gt=0, le=500)
    altura: Optional[float] = Field(None, gt=0, le=260)
    objetivo: Optional[str] = Field(None, max_length=300)
    restricoes: Optional[str] = Field(None, max_length=1000)
    observacoes: Optional[str] = Field(None, max_length=2000)


class CheckinRequest(BaseModel):
    peso_kg: float = Field(..., gt=0, le=500)
    cintura_cm: Optional[float] = Field(None, gt=0, le=300)
    quadril_cm: Optional[float] = Field(None, gt=0, le=300)
    adesao_percentual: int = Field(..., ge=0, le=100)
    energia: Optional[int] = Field(None, ge=0, le=10)
    sono: Optional[int] = Field(None, ge=0, le=10)
    dificuldades: Optional[str] = Field(None, max_length=2000)
    observacoes: Optional[str] = Field(None, max_length=2000)


def _paciente_id(usuario: Dict[str, Any]) -> int:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM pacientes WHERE usuario_id = %s", (usuario["id"],))
            registro = cur.fetchone()
    if not registro:
        raise HTTPException(status_code=404, detail="Perfil de paciente não encontrado.")
    return registro[0]


def _medidas(dados: CheckinRequest) -> dict:
    medidas = {}
    if dados.cintura_cm is not None:
        medidas["cintura_cm"] = dados.cintura_cm
    if dados.quadril_cm is not None:
        medidas["quadril_cm"] = dados.quadril_cm
    if dados.energia is not None:
        medidas["energia"] = dados.energia
    if dados.sono is not None:
        medidas["sono"] = dados.sono
    return medidas


def _numero(valor: Any) -> Optional[float]:
    try:
        return float(valor) if valor is not None else None
    except (TypeError, ValueError):
        return None


def _diferencas(anterior: dict, atual: dict) -> dict:
    diferencas = {}
    for campo in ("peso_kg", "cintura_cm", "quadril_cm", "adesao_percentual", "energia", "sono"):
        antes = _numero(anterior.get(campo))
        depois = _numero(atual.get(campo))
        if antes is not None and depois is not None:
            diferencas[campo] = round(depois - antes, 2)
    return diferencas


def _classificacao_local(diferencas: dict, objetivo: str = "") -> str:
    objetivo_normalizado = objetivo.lower()
    peso = diferencas.get("peso_kg")
    adesao = diferencas.get("adesao_percentual")
    reducao_desejada = any(x in objetivo_normalizado for x in ("emag", "perder", "reduzir", "baixar"))
    ganho_desejado = any(x in objetivo_normalizado for x in ("hipertrofia", "ganhar", "massa", "aumentar"))
    pontos = 0
    if peso is not None:
        if reducao_desejada:
            pontos += 1 if peso < -0.2 else -1 if peso > 0.2 else 0
        elif ganho_desejado:
            pontos += 1 if peso > 0.2 else -1 if peso < -0.2 else 0
    if adesao is not None:
        pontos += 1 if adesao >= 10 else -1 if adesao <= -10 else 0
    if pontos > 0:
        return "evolucao"
    if pontos < 0:
        return "involucao"
    return "estabilidade"


def _fallback(diferencas: dict, objetivo: str) -> dict:
    classificacao = _classificacao_local(diferencas, objetivo)
    resumo = {
        "evolucao": "Os dados indicam evolução em relação à referência anterior.",
        "estabilidade": "Os dados indicam estabilidade em relação à referência anterior.",
        "involucao": "Os dados indicam pontos de atenção em relação à referência anterior.",
    }[classificacao]
    positivos = ["Houve melhora na adesão ao plano."] if diferencas.get("adesao_percentual", 0) > 0 else []
    atencao = ["Houve redução na adesão ao plano."] if diferencas.get("adesao_percentual", 0) < 0 else []
    return {
        "classificacao": classificacao,
        "resumo": resumo,
        "pontos_positivos": positivos,
        "pontos_de_atencao": atencao,
        "observacoes": ["Comparação calculada localmente; recomenda-se avaliação profissional."],
        "requer_avaliacao_profissional": True,
    }


@router.put("/paciente/perfil-inicial")
def salvar_perfil_inicial(dados: PerfilInicialRequest, usuario: dict = Depends(exigir_paciente)):
    paciente_id = _paciente_id(usuario)
    perfil = dados.model_dump(exclude_none=True)
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE pacientes SET objetivo = COALESCE(%s, objetivo), restricoes_alimentares = COALESCE(%s, restricoes_alimentares), observacoes = COALESCE(%s, observacoes), dados_iniciais = CASE WHEN dados_iniciais = '{}'::jsonb THEN %s::jsonb ELSE dados_iniciais END WHERE id = %s",
                (dados.objetivo, dados.restricoes, dados.observacoes, json.dumps(perfil, ensure_ascii=False), paciente_id),
            )
    return {"sucesso": True, "dados_iniciais": perfil}


@router.get("/paciente/evolucao")
def listar_evolucao(usuario: dict = Depends(exigir_paciente)):
    paciente_id = _paciente_id(usuario)
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT dados_iniciais FROM pacientes WHERE id = %s", (paciente_id,))
            perfil = cur.fetchone()[0] or {}
            cur.execute("""
                SELECT c.id, c.data_checkin, c.peso_kg, c.medidas, c.adesao_percentual,
                       c.dificuldades, c.observacoes, a.classificacao, a.diferencas,
                       a.conteudo_json, a.status, a.criado_em
                FROM checkins c LEFT JOIN analises_checkins a ON a.checkin_id = c.id
                WHERE c.paciente_id = %s ORDER BY c.data_checkin DESC, c.id DESC
            """, (paciente_id,))
            linhas = cur.fetchall()
    return {"dados_iniciais": perfil, "checkins": [
        {"id": r[0], "data_checkin": r[1].isoformat(), "peso_kg": float(r[2]), "medidas": r[3] or {},
         "adesao_percentual": r[4], "dificuldades": r[5], "observacoes": r[6], "classificacao": r[7],
         "diferencas": r[8] or {}, "analise": r[9], "status_analise": r[10], "criado_em": r[11].isoformat() if r[11] else None}
        for r in linhas
    ]}


@router.post("/paciente/evolucao/checkins", status_code=status.HTTP_201_CREATED)
def criar_checkin(dados: CheckinRequest, usuario: dict = Depends(exigir_paciente)):
    paciente_id = _paciente_id(usuario)
    medidas = _medidas(dados)
    atual = {"peso_kg": dados.peso_kg, **medidas, "adesao_percentual": dados.adesao_percentual}
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT dados_iniciais FROM pacientes WHERE id = %s", (paciente_id,))
            perfil = cur.fetchone()[0] or {}
            cur.execute("SELECT id, peso_kg, medidas, adesao_percentual FROM checkins WHERE paciente_id = %s ORDER BY data_checkin DESC, id DESC LIMIT 1", (paciente_id,))
            anterior = cur.fetchone()
            if anterior:
                referencia = {"checkin_id": anterior[0], "peso_kg": float(anterior[1]), **(anterior[2] or {}), "adesao_percentual": anterior[3]}
            else:
                referencia = {"peso_kg": perfil.get("peso"), "altura": perfil.get("altura"), "objetivo": perfil.get("objetivo")}
            diferencas = _diferencas(referencia, atual)
            cur.execute("INSERT INTO checkins (paciente_id, peso_kg, medidas, adesao_percentual, dificuldades, observacoes) VALUES (%s, %s, %s::jsonb, %s, %s, %s) RETURNING id", (paciente_id, dados.peso_kg, json.dumps(medidas), dados.adesao_percentual, dados.dificuldades, dados.observacoes))
            checkin_id = cur.fetchone()[0]

    objetivo = perfil.get("objetivo") or ""
    resultado = _fallback(diferencas, objetivo)
    modelo = "regra-local"
    versao = "checkin-fallback-1"
    try:
        consentimento.exigir_consentimento_ia(paciente_id)
        resultado_ia = openai_service.gerar_estruturado(
            funcionalidade=openai_service.Funcionalidade.CHECKIN,
            instrucoes=prompts.INSTRUCOES_CHECKIN,
            dados={"objetivo": objetivo, "anterior": referencia, "atual": atual, "diferencas": diferencas},
            schema=AnaliseCheckin, usuario_id=usuario["id"], paciente_id=paciente_id,
        )
        resultado = resultado_ia.dados.model_dump()
        modelo = resultado_ia.modelo
        versao = prompts.VERSAO_CHECKIN
    except Exception:
        pass

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO analises_checkins (checkin_id, checkin_anterior_id, paciente_id, classificacao, diferencas, conteudo_json, modelo, versao_prompt, status) VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, 'finalizado')", (checkin_id, referencia.get("checkin_id"), paciente_id, resultado["classificacao"], json.dumps(diferencas), json.dumps(resultado, ensure_ascii=False), modelo, versao))
    return {"sucesso": True, "checkin_id": checkin_id, "comparacao": {"referencia": referencia, "atual": atual, "diferencas": diferencas}, "analise": resultado, "modelo": modelo}


@router.get("/nutricionista/evolucao")
def listar_evolucoes_nutricionista(usuario: dict = Depends(exigir_nutricionista)):
    """Lista análises finalizadas apenas de pacientes com vínculo ativo."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.id, c.paciente_id, u.nome, c.data_checkin, a.criado_em,
                       a.classificacao, a.conteudo_json, a.modelo
                FROM checkins c
                JOIN analises_checkins a ON a.checkin_id = c.id
                JOIN pacientes p ON p.id = c.paciente_id
                JOIN usuarios u ON u.id = p.usuario_id
                JOIN vinculos_nutricionistas v ON v.paciente_id = p.id
                    AND v.nutricionista_id = %s AND v.ativo = TRUE
                WHERE a.status = 'finalizado'
                ORDER BY a.criado_em DESC, c.id DESC;
            """, (usuario["id"],))
            linhas = cur.fetchall()

    itens = []
    for checkin_id, paciente_id, nome, data_checkin, criado_em, classificacao, conteudo, modelo in linhas:
        conteudo = conteudo or {}
        itens.append({
            "checkin_id": checkin_id,
            "paciente_id": paciente_id,
            "nome_paciente": nome,
            "data_checkin": data_checkin.isoformat() if data_checkin else None,
            "data_analise": criado_em.isoformat() if criado_em else None,
            "classificacao": classificacao,
            "resumo": conteudo.get("resumo"),
            "modelo": modelo,
        })
    return {"total": len(itens), "itens": itens}


@router.get("/nutricionista/evolucao/{checkin_id}")
def detalhar_evolucao_nutricionista(checkin_id: int, usuario: dict = Depends(exigir_nutricionista)):
    """Retorna o relatório completo de uma evolução autorizada."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.id, c.paciente_id, u.nome, c.data_checkin, c.peso_kg,
                       c.medidas, c.adesao_percentual, c.dificuldades, c.observacoes,
                       a.criado_em, a.classificacao, a.diferencas, a.conteudo_json,
                       a.modelo, a.versao_prompt, prev.id, prev.data_checkin,
                       prev.peso_kg, prev.medidas, prev.adesao_percentual
                FROM checkins c
                JOIN analises_checkins a ON a.checkin_id = c.id
                JOIN pacientes p ON p.id = c.paciente_id
                JOIN usuarios u ON u.id = p.usuario_id
                JOIN vinculos_nutricionistas v ON v.paciente_id = p.id
                    AND v.nutricionista_id = %s AND v.ativo = TRUE
                LEFT JOIN checkins prev ON prev.id = a.checkin_anterior_id
                WHERE c.id = %s AND a.status = 'finalizado';
            """, (usuario["id"], checkin_id))
            item = cur.fetchone()

    if not item:
        raise HTTPException(status_code=404, detail="Relatório de evolução não encontrado ou não autorizado.")

    return {
        "checkin_id": item[0], "paciente_id": item[1], "nome_paciente": item[2],
        "data_checkin": item[3].isoformat() if item[3] else None,
        "data_analise": item[9].isoformat() if item[9] else None,
        "atual": {"peso_kg": float(item[4]), "medidas": item[5] or {}, "adesao_percentual": item[6], "dificuldades": item[7], "observacoes": item[8]},
        "referencia": {"data_checkin": item[16].isoformat() if item[16] else None, "peso_kg": float(item[17]) if item[17] is not None else None, "medidas": item[18] or {}, "adesao_percentual": item[19]},
        "classificacao": item[10], "diferencas": item[11] or {}, "analise": item[12] or {}, "modelo": item[13], "versao_prompt": item[14],
    }
