"""Smoke test nao destrutivo do backend WishDiet."""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Callable

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))
load_dotenv(PROJECT_DIR / ".env")


def _check(nome: str, func: Callable[[], None]) -> None:
    try:
        func()
    except Exception as erro:
        raise RuntimeError(f"{nome}: {type(erro).__name__}: {erro}") from erro
    print(f"OK  {nome}")


def smoke_api() -> None:
    """Verifica FastAPI, OpenAPI, validacao e protecao sem alterar o banco."""
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)

    def raiz() -> None:
        resposta = client.get("/")
        assert resposta.status_code == 200, resposta.text
        assert resposta.json().get("status") == "online"

    def contrato() -> None:
        resposta = client.get("/openapi.json")
        assert resposta.status_code == 200, resposta.text
        rotas = resposta.json().get("paths", {})
        esperadas = {"/", "/auth/cadastro", "/auth/login", "/auth/me"}
        assert not esperadas - set(rotas), sorted(esperadas - set(rotas))

    def validacao() -> None:
        assert client.post("/auth/cadastro", json={}).status_code == 422
        assert client.post("/auth/login", json={}).status_code == 422

    def protecao() -> None:
        for rota in ("/auth/me", "/admin/nutricionistas-pendentes", "/paciente/evolucao"):
            resposta = client.get(rota)
            assert resposta.status_code == 401, f"{rota}: {resposta.status_code}"

    _check("GET /", raiz)
    _check("contrato OpenAPI", contrato)
    _check("validacao de autenticacao", validacao)
    _check("protecao de rotas", protecao)


def smoke_ia() -> None:
    """Faz uma chamada real barata quando OPENAI_API_KEY esta configurada."""
    if not os.getenv("OPENAI_API_KEY", "").strip():
        print("SKIP IA  OPENAI_API_KEY nao configurada")
        return

    from schemas.checkin_schema import AnaliseCheckin
    from services.openai_service import (
        Funcionalidade,
        IAIndisponivelError,
        gerar_estruturado,
        modelo_da_funcionalidade,
    )
    from services.prompts import INSTRUCOES_CHECKIN

    dados = {
        "objetivo": "Emagrecimento",
        "anterior": {"peso_kg": 80.0, "adesao_percentual": 70},
        "atual": {"peso_kg": 79.2, "adesao_percentual": 80},
        "diferencas": {"peso_kg": -0.8, "adesao_percentual": 10},
        "dificuldades": "Fim de semana dificil",
    }
    modelo = modelo_da_funcionalidade(Funcionalidade.CHECKIN)
    try:
        resultado = gerar_estruturado(
            funcionalidade=Funcionalidade.CHECKIN,
            instrucoes=INSTRUCOES_CHECKIN,
            dados=dados,
            schema=AnaliseCheckin,
        )
    except IAIndisponivelError as erro:
        raise RuntimeError(f"IA [{erro.codigo}]: {erro.mensagem}") from erro

    assert isinstance(resultado.dados, AnaliseCheckin)
    assert resultado.modelo == modelo
    assert resultado.dados.classificacao in {"evolucao", "estabilidade", "involucao"}
    assert resultado.dados.resumo.strip()
    print(f"OK  OpenAI check-in ({resultado.modelo})")


def smoke_plano() -> None:
    """Gera um plano sintetico e valida as regras essenciais do produto."""
    if not os.getenv("OPENAI_API_KEY", "").strip():
        print("SKIP PLANO  OPENAI_API_KEY nao configurada")
        return

    from schemas.plano_schema import PlanoAlimentar
    from services.openai_service import (
        Funcionalidade,
        IAIndisponivelError,
        gerar_estruturado,
        modelo_da_funcionalidade,
    )
    from services.prompts import INSTRUCOES_PLANO

    restricao = "Sem lactose"
    dados = {
        "paciente": {
            "nome": "Paciente Smoke Test",
            "objetivo": "Reducao de peso",
            "restricoes": [restricao],
            "observacoes": "Preferencia por comida brasileira; quatro refeicoes por dia.",
            "dados_iniciais": {"refeicoes_por_dia": 4},
        },
        "ultima_evolucao": None,
        "catalogo_taco_aprovado": [],
    }
    modelo = modelo_da_funcionalidade(Funcionalidade.PLANO)
    try:
        resultado = gerar_estruturado(
            funcionalidade=Funcionalidade.PLANO,
            instrucoes=INSTRUCOES_PLANO,
            dados=dados,
            schema=PlanoAlimentar,
        )
    except IAIndisponivelError as erro:
        if erro.codigo != "resposta_invalida":
            raise RuntimeError(f"IA plano [{erro.codigo}]: {erro.mensagem}") from erro
        resultado = gerar_estruturado(
            funcionalidade=Funcionalidade.PLANO,
            instrucoes=INSTRUCOES_PLANO + (
                " A tentativa anterior foi invalida. Confira antes de responder: "
                "use pelo menos uma refeicao, itens em cada refeicao e exatamente duas substituicoes."
            ),
            dados=dados,
            schema=PlanoAlimentar,
        )

    plano = resultado.dados
    if not plano.refeicoes or any(
        len(refeicao.itens) == 0
        or (
            refeicao.nome.strip().casefold() not in {"cafe da manha", "cafÃ© da manhÃ£"}
            and len(refeicao.substituicoes) != 2
        )
        for refeicao in plano.refeicoes
    ):
        resultado = gerar_estruturado(
            funcionalidade=Funcionalidade.PLANO,
            instrucoes=INSTRUCOES_PLANO + (
                " A resposta anterior falhou na validacao. Gere novamente um plano completo, "
                "com pelo menos uma refeicao, itens em cada refeicao e exatamente duas substituicoes, exceto no cafe da manha."
            ),
            dados=dados,
            schema=PlanoAlimentar,
        )
        plano = resultado.dados
    assert isinstance(plano, PlanoAlimentar)
    assert resultado.modelo == modelo
    assert plano.refeicoes, "A IA retornou um plano sem refeicoes"
    assert plano.requer_revisao_profissional is True
    assert any(restricao.lower() in item.lower() for item in plano.restricoes_consideradas)

    termos_proibidos = {"leite", "queijo", "iogurte", "manteiga", "lactose"}
    for refeicao in plano.refeicoes:
        if refeicao.nome.strip().casefold() not in {"cafe da manha", "cafÃ© da manhÃ£"}:
            assert len(refeicao.substituicoes) == 2, refeicao.nome
        for item in refeicao.itens:
            texto = item.alimento.lower()
            assert not termos_proibidos & set(texto.split()), f"Restricao violada: {item.alimento}"
        for substituicao in refeicao.substituicoes:
            assert substituicao.justificativa.strip()
            assert substituicao.equivalencia_nutricional.strip()
            texto = substituicao.alimento_substituto.lower()
            assert not termos_proibidos & set(texto.split()), f"Restricao violada: {substituicao.alimento_substituto}"
    print(f"OK  OpenAI plano alimentar ({resultado.modelo}, {len(plano.refeicoes)} refeicoes)")


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test do backend WishDiet")
    parser.add_argument("--skip-ia", action="store_true", help="nao chama a OpenAI")
    parser.add_argument("--plano", action="store_true", help="tambem testa geracao real de plano alimentar")
    args = parser.parse_args()
    try:
        smoke_api()
        if not args.skip_ia:
            smoke_ia()
        if args.plano:
            smoke_plano()
    except Exception as erro:
        print(f"FALHOU {erro}", file=sys.stderr)
        return 1
    print("SMOKE PASSOU")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
