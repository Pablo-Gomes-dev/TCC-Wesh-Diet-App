import pytest
from fastapi import HTTPException

from routers.planos import validar_conteudo_plano
from schemas.plano_schema import PlanoAlimentar


def plano(substituicoes=2, revisao=True):
    return PlanoAlimentar.model_validate({
        "objetivo_nutricional": "Redução de peso",
        "refeicoes": [{
            "nome": "Café da manhã",
            "horario_sugerido": "08:00",
            "itens": [{"alimento": "Pão integral", "quantidade": 2, "unidade": "fatias"}],
            "substituicoes": [{
                "alimento_original": "Pão integral",
                "alimento_substituto": f"Opção {i + 1}",
                "quantidade_substituto": 1,
                "unidade_substituto": "porção",
                "justificativa": "Mantém a função da refeição.",
                "equivalencia_nutricional": "Porção equivalente de carboidrato.",
            } for i in range(substituicoes)],
        }],
        "observacoes": [],
        "restricoes_consideradas": ["Sem lactose"],
        "requer_revisao_profissional": revisao,
    })


def test_plano_valido_exige_duas_substituicoes():
    validar_conteudo_plano(plano())


def test_plano_rejeita_quantidade_diferente_de_duas_substituicoes():
    dados = plano(1).model_dump()
    dados["refeicoes"][0]["nome"] = "Almoco"
    with pytest.raises(HTTPException) as erro:
        validar_conteudo_plano(PlanoAlimentar.model_validate(dados))
    assert erro.value.status_code == 422


def test_plano_rejeita_sem_revisao_profissional():
    with pytest.raises(HTTPException) as erro:
        validar_conteudo_plano(plano(revisao=False))
    assert erro.value.status_code == 422


def test_schema_rejeita_substituicao_sem_justificativa():
    dados = plano().model_dump()
    dados["refeicoes"][0]["substituicoes"][0].pop("justificativa")
    with pytest.raises(ValueError):
        PlanoAlimentar.model_validate(dados)
