# TESTES UNITÁRIOS DA MINIMIZAÇÃO DE DADOS (SEM BANCO E SEM REDE)
import json
from datetime import date
 
from services.payload_ia import (
    calcular_idade, higienizar_texto, lista_restricoes, montar_payload_paciente,
)
 
 
def test_idade_antes_e_no_aniversario():
    assert calcular_idade(date(1990, 6, 15), date(2024, 6, 14)) == 33
    assert calcular_idade(date(1990, 6, 15), date(2024, 6, 15)) == 34
 
 
def test_idade_ausente_ou_absurda():
    assert calcular_idade(None) is None
    assert calcular_idade(date(1800, 1, 1), date(2024, 1, 1)) is None
 
 
def test_payload_tem_idade_imc_e_nao_tem_identificadores():
    p = montar_payload_paciente(
        data_nascimento=date(1990, 1, 1), peso_kg=80, altura_cm=175,
        objetivo="Emagrecimento", restricoes="Lactose, glúten", hoje=date(2024, 1, 1),
    )
    assert p["idade"] == 34
    assert p["imc"] == 26.12
    assert p["classificacao_imc"] == "Sobrepeso"
    assert p["restricoes"] == ["Lactose", "glúten"]
    texto = json.dumps(p, ensure_ascii=False).lower()
    for proibido in ("nome", "email", "nascimento", "1990"):
        assert proibido not in texto
 
 
def test_sem_altura_nao_calcula_imc():
    p = montar_payload_paciente(data_nascimento=None, peso_kg=80, altura_cm=None,
                                objetivo=None, restricoes="Nenhuma")
    assert "imc" not in p and "restricoes" not in p and "idade" not in p
 
 
def test_observacoes_ficam_de_fora_por_padrao():
    p = montar_payload_paciente(data_nascimento=None, peso_kg=70, altura_cm=170,
                                objetivo="x", restricoes=None, observacoes="algo")
    assert "observacoes" not in p
 
 
def test_higienizacao_remove_email_cpf_e_telefone():
    t = higienizar_texto("Ligar (11) 98765-4321 ou joao@x.com, CPF 123.456.789-09")
    assert "98765" not in t and "@" not in t and "789" not in t
    assert t.count("[removido]") == 3
 
 
def test_restricoes_nenhuma_vira_lista_vazia():
    assert lista_restricoes("Nenhuma") == []
    assert lista_restricoes("lactose; amendoim\nglúten") == ["lactose", "amendoim", "glúten"]
 