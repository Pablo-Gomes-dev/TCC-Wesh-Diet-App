import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from auth import exigir_nutricionista, exigir_paciente, verificar_vinculo_nutricionista_paciente
from database import get_db_connection
from schemas.plano_schema import PlanoAlimentar
from services import auditoria, consentimento, openai_service, prompts
from routers.taco import catalogo_aprovado

router = APIRouter(tags=["planos"])


class GerarPlanoRequest(BaseModel):
    paciente_id: int = Field(..., gt=0)


class RevisaoPlanoRequest(BaseModel):
    observacao: str = Field(..., min_length=3, max_length=2000)


class EditarPlanoRequest(BaseModel):
    conteudo: PlanoAlimentar


def validar_conteudo_plano(conteudo: PlanoAlimentar) -> None:
    """Regra única usada na edição e aprovação do plano."""
    if not conteudo.requer_revisao_profissional:
        raise HTTPException(status_code=422, detail="O plano deve permanecer marcado para revisão profissional.")
    if not conteudo.refeicoes:
        raise HTTPException(status_code=422, detail="O plano precisa conter ao menos uma refeição.")
    if any(len(refeicao.substituicoes) != 2 for refeicao in conteudo.refeicoes):
        raise HTTPException(status_code=422, detail="Cada refeição precisa conter exatamente duas substituições.")


def _serializar(plano: Dict[str, Any]) -> Dict[str, Any]:
    for campo in ("criado_em", "atualizado_em", "aprovado_em", "revisao_solicitada_em"):
        if plano.get(campo): plano[campo] = plano[campo].isoformat()
    return plano


def _contexto(cur, paciente_id: int, nutricionista_id: int) -> Dict[str, Any]:
    if not verificar_vinculo_nutricionista_paciente(nutricionista_id, paciente_id):
        raise HTTPException(status_code=403, detail="Você não possui vínculo ativo com este paciente.")
    cur.execute("""SELECT p.id, u.nome, p.objetivo, p.restricoes_alimentares, p.observacoes, p.dados_iniciais
                   FROM pacientes p JOIN usuarios u ON u.id=p.usuario_id WHERE p.id=%s""", (paciente_id,))
    p = cur.fetchone()
    if not p: raise HTTPException(status_code=404, detail="Paciente não encontrado.")
    cur.execute("""SELECT c.id,c.data_checkin,c.peso_kg,c.medidas,c.adesao_percentual,c.dificuldades,c.observacoes,
                          a.classificacao,a.diferencas,a.conteudo_json,a.criado_em
                   FROM checkins c LEFT JOIN analises_checkins a ON a.checkin_id=c.id
                   WHERE c.paciente_id=%s ORDER BY c.data_checkin DESC,c.id DESC LIMIT 1""", (paciente_id,))
    c = cur.fetchone()
    evolucao = None
    if c:
        evolucao = {"checkin_id": c[0], "data_checkin": c[1].isoformat() if c[1] else None, "peso_kg": float(c[2]),
                    "medidas": c[3] or {}, "adesao_percentual": c[4], "dificuldades": c[5], "observacoes": c[6],
                    "classificacao": c[7], "diferencas": c[8] or {}, "analise": c[9] or {},
                    "data_analise": c[10].isoformat() if c[10] else None}
    return {"paciente_id": p[0], "nome": p[1], "objetivo": p[2], "restricoes": p[3], "observacoes": p[4],
            "dados_iniciais": p[5] or {}, "ultima_evolucao": evolucao}


@router.get("/nutricionista/planos/pacientes")
def listar_pacientes_plano(usuario: dict = Depends(exigir_nutricionista)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""SELECT p.id,u.nome,u.email FROM pacientes p JOIN usuarios u ON u.id=p.usuario_id
                           JOIN vinculos_nutricionistas v ON v.paciente_id=p.id
                           WHERE v.nutricionista_id=%s AND v.ativo=TRUE ORDER BY u.nome""", (usuario["id"],))
            return {"pacientes": [{"id": r[0], "nome": r[1], "email": r[2]} for r in cur.fetchall()]}


@router.get("/nutricionista/planos/pacientes/{paciente_id}/contexto")
def contexto_plano(paciente_id: int, usuario: dict = Depends(exigir_nutricionista)):
    with get_db_connection() as conn:
        with conn.cursor() as cur: return _contexto(cur, paciente_id, usuario["id"])


@router.post("/nutricionista/planos/gerar", status_code=status.HTTP_201_CREATED)
def gerar_plano(dados: GerarPlanoRequest, usuario: dict = Depends(exigir_nutricionista)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            contexto = _contexto(cur, dados.paciente_id, usuario["id"])
            try:
                catalogo = catalogo_aprovado(cur)
            except Exception:
                catalogo = []
    consentimento.exigir_consentimento_ia(dados.paciente_id)
    entrada = {"paciente": {"objetivo": contexto["objetivo"], "restricoes": contexto["restricoes"], "observacoes": contexto["observacoes"], "dados_iniciais": contexto["dados_iniciais"]}, "ultima_evolucao": contexto["ultima_evolucao"], "catalogo_taco_aprovado": catalogo}
    resultado = openai_service.gerar_estruturado(funcionalidade=openai_service.Funcionalidade.PLANO, instrucoes=prompts.INSTRUCOES_PLANO, dados=entrada, schema=PlanoAlimentar, usuario_id=usuario["id"], paciente_id=dados.paciente_id)
    plano_json = resultado.dados.model_dump()
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""INSERT INTO planos_alimentares (paciente_id,nutricionista_id,conteudo_json,status,gerado_por_ia,modelo,versao_prompt,contexto_geracao)
                         VALUES (%s,%s,%s::jsonb,'rascunho',TRUE,%s,%s,%s::jsonb) RETURNING id,criado_em,atualizado_em""", (dados.paciente_id, usuario["id"], json.dumps(plano_json, ensure_ascii=False), resultado.modelo, prompts.VERSAO_PLANO, json.dumps(entrada, ensure_ascii=False)))
            r = cur.fetchone(); conn.commit()
    auditoria.registrar(usuario["id"], "plano_gerado", "planos_alimentares", r[0])
    return {"id": r[0], "paciente_id": dados.paciente_id, "status": "rascunho", "conteudo": plano_json, "modelo": resultado.modelo, "criado_em": r[1].isoformat(), "atualizado_em": r[2].isoformat()}


@router.get("/nutricionista/planos/{plano_id}")
def obter_plano_nutricionista(plano_id: int, usuario: dict = Depends(exigir_nutricionista)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id,paciente_id,nutricionista_id,conteudo_json,status,modelo,versao_prompt,contexto_geracao,observacao_revisao,criado_em,atualizado_em,aprovado_em,revisao_solicitada_em FROM planos_alimentares WHERE id=%s AND nutricionista_id=%s", (plano_id, usuario["id"]))
            r = cur.fetchone()
    if not r: raise HTTPException(status_code=404, detail="Plano não encontrado.")
    return {"id":r[0],"paciente_id":r[1],"nutricionista_id":r[2],"conteudo":r[3],"status":r[4],"modelo":r[5],"versao_prompt":r[6],"contexto_geracao":r[7] or {},"observacao_revisao":r[8],"criado_em":r[9].isoformat(),"atualizado_em":r[10].isoformat(),"aprovado_em":r[11].isoformat() if r[11] else None,"revisao_solicitada_em":r[12].isoformat() if r[12] else None}


@router.patch("/nutricionista/planos/{plano_id}")
def editar_plano(plano_id: int, dados: EditarPlanoRequest, usuario: dict = Depends(exigir_nutricionista)):
    conteudo = dados.conteudo.model_dump()
    validar_conteudo_plano(dados.conteudo)
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""UPDATE planos_alimentares
                           SET conteudo_json=%s::jsonb, status='rascunho', observacao_revisao=NULL,
                               revisao_solicitada_por=NULL, revisao_solicitada_em=NULL, atualizado_em=NOW()
                           WHERE id=%s AND nutricionista_id=%s AND status IN ('rascunho','revisao_solicitada')
                           RETURNING id""", (json.dumps(conteudo, ensure_ascii=False), plano_id, usuario["id"]))
            r = cur.fetchone()
            conn.commit()
    if not r:
        raise HTTPException(status_code=404, detail="Somente rascunhos ou planos em revisão podem ser editados.")
    return {"sucesso": True, "id": plano_id, "status": "rascunho", "conteudo": conteudo}


@router.post("/nutricionista/planos/{plano_id}/revisao")
def solicitar_revisao(plano_id: int, dados: RevisaoPlanoRequest, usuario: dict = Depends(exigir_nutricionista)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE planos_alimentares SET status='revisao_solicitada',observacao_revisao=%s,revisao_solicitada_por=%s,revisao_solicitada_em=NOW(),atualizado_em=NOW() WHERE id=%s AND nutricionista_id=%s RETURNING id", (dados.observacao, usuario["id"], plano_id, usuario["id"]))
            r=cur.fetchone(); conn.commit()
    if not r: raise HTTPException(status_code=404, detail="Plano não encontrado.")
    return {"sucesso": True, "status": "revisao_solicitada"}


@router.post("/nutricionista/planos/{plano_id}/aprovar")
def aprovar_plano(plano_id: int, usuario: dict = Depends(exigir_nutricionista)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT paciente_id,conteudo_json,status FROM planos_alimentares WHERE id=%s AND nutricionista_id=%s", (plano_id, usuario["id"]))
            r=cur.fetchone()
            if not r: raise HTTPException(status_code=404, detail="Plano não encontrado.")
            conteudo_obj = PlanoAlimentar.model_validate(r[1] or {})
            validar_conteudo_plano(conteudo_obj)
            cur.execute("UPDATE planos_alimentares SET status='arquivado',atualizado_em=NOW() WHERE paciente_id=%s AND status='aprovado'", (r[0],))
            cur.execute("UPDATE planos_alimentares SET status='aprovado',aprovado_por=%s,aprovado_em=NOW(),atualizado_em=NOW() WHERE id=%s RETURNING id", (usuario["id"], plano_id))
            conn.commit()
    return {"sucesso": True, "status": "aprovado"}


@router.get("/paciente/meu-plano")
def meu_plano(usuario: dict = Depends(exigir_paciente)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT p.id,pa.id,pa.conteudo_json,pa.aprovado_em FROM pacientes p JOIN planos_alimentares pa ON pa.paciente_id=p.id WHERE p.usuario_id=%s AND pa.status='aprovado' ORDER BY pa.aprovado_em DESC LIMIT 1", (usuario["id"],))
            r=cur.fetchone()
    if not r: return {"plano": None}
    return {"plano": {"id":r[1],"paciente_id":r[0],"conteudo":r[2],"aprovado_em":r[3].isoformat() if r[3] else None}}
