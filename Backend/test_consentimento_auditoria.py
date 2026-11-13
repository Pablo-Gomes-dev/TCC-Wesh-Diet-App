# ==============================================================================
# TESTES DE CONSENTIMENTO (LGPD) E AUDITORIA - USAM O BANCO DE TESTE/DESENVOLVIMENTO
# ==============================================================================
# Os dois últimos testes só passam depois que a auditoria for adicionada às rotas
# de login em main.py (passo 4 do guia).
# ==============================================================================
 
import time
 
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
 
import database
from database import get_db_connection
from main import app
from services import auditoria, consentimento
 
cliente = TestClient(app)
SENHA = "SenhaForte123@"
 
 
def _consultar(sql, params=()):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()
 
 
def _cadastrar(tipo="paciente"):
    email = f"{tipo}_{time.time_ns()}@teste.com"
    corpo = {"nome": f"Teste {tipo}", "email": email, "senha": SENHA, "tipo_usuario": tipo}
    if tipo == "nutricionista":
        corpo["crn"] = f"CRN-3 {time.time_ns() % 100000}/P"
    r = cliente.post("/auth/cadastro", json=corpo)
    assert r.status_code == 201
    dados = r.json()
    return email, {"Authorization": f"Bearer {dados['token']}"}, dados["usuario"]["id"]
 
 
def _contar_auditoria(usuario_id, acao):
    return _consultar(
        "SELECT COUNT(*) FROM log_auditoria WHERE usuario_id = %s AND acao = %s;",
        (usuario_id, acao),
    )[0][0]
 
 
# ----------------------------- CONSENTIMENTO ----------------------------------
 
def test_novo_paciente_nao_tem_consentimento():
    _, h, _ = _cadastrar()
    r = cliente.get("/consentimento/ia", headers=h)
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["concedido"] is False
    assert len(corpo["texto"]) > 50 and corpo["versao_texto"]
 
 
def test_consulta_sem_token_e_negada():
    assert cliente.get("/consentimento/ia").status_code == 401
 
 
def test_aceitar_e_revogar_mantem_historico_e_audita():
    _, h, uid = _cadastrar()
 
    assert cliente.post("/consentimento/ia", json={"concedido": True}, headers=h).status_code == 200
    assert cliente.get("/consentimento/ia", headers=h).json()["concedido"] is True
    assert _contar_auditoria(uid, "consentimento_ia_concedido") == 1
 
    assert cliente.post("/consentimento/ia", json={"concedido": False}, headers=h).status_code == 200
    assert cliente.get("/consentimento/ia", headers=h).json()["concedido"] is False
    assert _contar_auditoria(uid, "consentimento_ia_revogado") == 1
 
    total = _consultar("SELECT COUNT(*) FROM consentimentos WHERE usuario_id = %s;", (uid,))[0][0]
    assert total == 2  # histórico append-only: nada é sobrescrito
 
 
def test_nutricionista_nao_registra_consentimento_de_paciente():
    _, h, _ = _cadastrar("nutricionista")
    assert cliente.post("/consentimento/ia", json={"concedido": True}, headers=h).status_code == 403
 
 
def test_nova_versao_do_texto_exige_novo_aceite(monkeypatch):
    _, h, uid = _cadastrar()
    cliente.post("/consentimento/ia", json={"concedido": True}, headers=h)
    assert consentimento.consentimento_vigente(uid) is True
    monkeypatch.setattr(consentimento, "VERSAO_TEXTO_IA", "9.9")
    assert consentimento.consentimento_vigente(uid) is False
 
 
def test_exigir_consentimento_ia_bloqueia_e_libera():
    _, h, uid = _cadastrar()
    paciente_id = _consultar("SELECT id FROM pacientes WHERE usuario_id = %s;", (uid,))[0][0]
 
    with pytest.raises(HTTPException) as exc:
        consentimento.exigir_consentimento_ia(paciente_id)
    assert exc.value.status_code == 403
    assert exc.value.detail["codigo"] == "CONSENTIMENTO_IA_AUSENTE"
 
    cliente.post("/consentimento/ia", json={"concedido": True}, headers=h)
    assert consentimento.exigir_consentimento_ia(paciente_id) is None
 
 
# ------------------------------- AUDITORIA ------------------------------------
 
def test_auditoria_grava_linha():
    _, _, uid = _cadastrar()
    auditoria.registrar(uid, "teste_acao", "teste", 42)
    linhas = _consultar(
        "SELECT recurso, recurso_id, resultado FROM log_auditoria WHERE usuario_id = %s AND acao = 'teste_acao';",
        (uid,),
    )
    assert linhas == [("teste", 42, "sucesso")]
 
 
def test_falha_na_auditoria_nao_derruba_a_requisicao(monkeypatch):
    def banco_fora(*a, **k):
        raise RuntimeError("banco indisponível")
 
    monkeypatch.setattr(database, "get_db_connection", banco_fora)
    assert auditoria.registrar(None, "x", "y") is None  # não levanta exceção
 
 
def test_login_gera_auditoria():  # exige o passo 4 (auditoria em main.py)
    email, _, uid = _cadastrar()
    r = cliente.post("/auth/login", json={"email": email, "senha": SENHA})
    assert r.status_code == 200
    assert _contar_auditoria(uid, "login") == 1
 
 
def test_login_com_senha_errada_gera_auditoria_de_falha():  # exige o passo 4
    email, _, uid = _cadastrar()
    r = cliente.post("/auth/login", json={"email": email, "senha": "errada123"})
    assert r.status_code == 401
    linhas = _consultar(
        "SELECT resultado FROM log_auditoria WHERE usuario_id = %s AND acao = 'login_falha';", (uid,)
    )
    assert linhas == [("falha",)]
 