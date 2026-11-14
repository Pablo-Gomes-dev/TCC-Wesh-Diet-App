# ==============================================================================
# TESTES DE CADASTRO, AUTENTICAÇÃO E CONTROLE DE ACESSO POR PAPÉIS - WISHDIET
# ==============================================================================
# Esta suíte valida:
# 1. Cadastro e login de Pacientes e Nutricionistas.
# 2. Escolha e persistência do papel ('paciente' ou 'nutricionista').
# 3. Autenticação alternativa com Google (opcional e sem senhas inventadas).
# 4. Bloqueio de acesso cruzado (paciente bloqueado de rotas de nutri e vice-versa).
# 5. Bloqueio de alteração de papel pelo frontend.
# 6. Proteção de dados entre pacientes e exigência de vínculo para nutricionistas.
# ==============================================================================

import time
import jwt
from fastapi.testclient import TestClient
from main import app
from database import get_db_connection

cliente = TestClient(app)

# Prefixo único para evitar conflito de dados nos testes
TIMESTAMP = int(time.time())
EMAIL_PACIENTE_1 = f"paciente1_{TIMESTAMP}@teste.com"
EMAIL_PACIENTE_2 = f"paciente2_{TIMESTAMP}@teste.com"
EMAIL_NUTRI_1 = f"nutri1_{TIMESTAMP}@teste.com"
EMAIL_NUTRI_SEM_VINCULO = f"nutri_sem_vinculo_{TIMESTAMP}@teste.com"
SENHA_PADRAO = "SenhaForte123@"


# ------------------------------------------------------------------------------
# 1. TESTE DE CADASTRO DE PACIENTE E NUTRICIONISTA
# ------------------------------------------------------------------------------

def test_cadastro_paciente_sucesso():
    dados = {
        "nome": "João Paciente Teste",
        "email": EMAIL_PACIENTE_1,
        "senha": SENHA_PADRAO,
        "tipo_usuario": "paciente"
    }
    resposta = cliente.post("/auth/cadastro", json=dados)
    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["sucesso"] is True
    assert corpo["usuario"]["tipo_usuario"] == "paciente"
    assert "token" in corpo

    # Verifica se foi criado registro correspondente na tabela pacientes
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM pacientes WHERE usuario_id = %s;", (corpo["usuario"]["id"],))
            assert cur.fetchone() is not None


def test_cadastro_nutricionista_com_crn():
    dados = {
        "nome": "Dra. Maria Nutricionista",
        "email": EMAIL_NUTRI_1,
        "senha": SENHA_PADRAO,
        "tipo_usuario": "nutricionista",
        "crn": "CRN-3 12345/P"
    }
    resposta = cliente.post("/auth/cadastro", json=dados)
    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["sucesso"] is True
    assert corpo["usuario"]["tipo_usuario"] == "nutricionista"
    # Conforme as regras de segurança, novos nutricionistas iniciam com status 'pendente'
    assert corpo["usuario"]["status_aprovacao"] == "pendente"

    # Atualiza o status para 'aprovado' para permitir a execução dos demais testes de rotas profissionais
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE usuarios SET status_aprovacao = 'aprovado' WHERE email = %s;", (EMAIL_NUTRI_1,))


def test_cadastro_papel_invalido_rejeitado():
    dados = {
        "nome": "Tentativa Invasor",
        "email": f"invasor_{TIMESTAMP}@teste.com",
        "senha": SENHA_PADRAO,
        "tipo_usuario": "administrador"  # Papel não permitido pelo schema
    }
    resposta = cliente.post("/auth/cadastro", json=dados)
    assert resposta.status_code == 400
    assert "inválido" in resposta.json()["detail"].lower()


# ------------------------------------------------------------------------------
# 2. TESTE DE LOGIN TRADICIONAL E DIRECIONAMENTO POR PAPEL
# ------------------------------------------------------------------------------

def test_login_paciente_retorna_papel_correto():
    dados = {"email": EMAIL_PACIENTE_1, "senha": SENHA_PADRAO}
    resposta = cliente.post("/auth/login", json=dados)
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["sucesso"] is True
    assert corpo["usuario"]["tipo_usuario"] == "paciente"
    assert "token" in corpo


def test_login_nutricionista_retorna_papel_correto():
    dados = {"email": EMAIL_NUTRI_1, "senha": SENHA_PADRAO}
    resposta = cliente.post("/auth/login", json=dados)
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["sucesso"] is True
    assert corpo["usuario"]["tipo_usuario"] == "nutricionista"


def test_login_senha_incorreta_rejeitado():
    dados = {"email": EMAIL_PACIENTE_1, "senha": "SenhaErradaTotal"}
    resposta = cliente.post("/auth/login", json=dados)
    assert resposta.status_code == 401


# ------------------------------------------------------------------------------
# 3. TESTE DE AUTENTICAÇÃO COM GOOGLE (OPCIONAL E SEM SOBREPOSIÇÃO)
# ------------------------------------------------------------------------------

from unittest.mock import patch

def test_login_google_novo_usuario_e_bloqueio_de_sobrescrita():
    google_id = f"google_id_{TIMESTAMP}"
    email_google = f"google_user_{TIMESTAMP}@gmail.com"

    # Mock da validação oficial do Google Identity Services para simular a resposta de um token válido
    with patch("main.validar_credencial_google") as mock_valida:
        mock_valida.return_value = {
            "google_id": google_id,
            "email": email_google,
            "nome": "Usuario Google Teste"
        }

        # 1. Primeira entrada com Google: deve exigir o papel
        dados_sem_papel = {"id_token": "token_google_mockado"}
        resp1 = cliente.post("/auth/google", json=dados_sem_papel)
        assert resp1.status_code == 400
        assert resp1.json()["detail"]["codigo"] == "PAPEL_OBRIGATORIO"

        # 2. Cadastro com Google informando papel 'paciente'
        dados_com_papel = {
            "id_token": "token_google_mockado",
            "tipo_usuario": "paciente"
        }
        resp2 = cliente.post("/auth/google", json=dados_com_papel)
        assert resp2.status_code == 200
        corpo2 = resp2.json()
        assert corpo2["usuario"]["tipo_usuario"] == "paciente"

        # 3. Segunda entrada com Google tentando alterar o papel para 'nutricionista':
        # O backend DEVE IGNORAR a tentativa de alteração e manter 'paciente'!
        dados_tentativa_alteracao = {
            "id_token": "token_google_mockado",
            "tipo_usuario": "nutricionista"
        }
        resp3 = cliente.post("/auth/google", json=dados_tentativa_alteracao)
        assert resp3.status_code == 200
        corpo3 = resp3.json()
        assert corpo3["usuario"]["tipo_usuario"] == "paciente"  # Papel preservado!


# ------------------------------------------------------------------------------
# 4. TESTE DE AUTORIZAÇÃO E BLOQUEIO DE ACESSO CRUZADO
# ------------------------------------------------------------------------------

def test_paciente_bloqueado_em_rotas_de_nutricionista():
    # Login do paciente para obter token
    login_paciente = cliente.post("/auth/login", json={"email": EMAIL_PACIENTE_1, "senha": SENHA_PADRAO}).json()
    token_paciente = login_paciente["token"]
    headers = {"Authorization": f"Bearer {token_paciente}"}

    # Paciente acessa sua rota própria: Sucesso (200)
    resp_propria = cliente.get("/auth/paciente/meu-espaco", headers=headers)
    assert resp_propria.status_code == 200

    # Paciente tenta acessar painel de nutricionista: Proibido (403)
    resp_bloqueada = cliente.get("/auth/nutricionista/meu-painel", headers=headers)
    assert resp_bloqueada.status_code == 403
    assert "nutricionistas" in resp_bloqueada.json()["detail"].lower()


def test_nutricionista_bloqueado_em_rotas_de_paciente():
    # Login do nutricionista para obter token
    login_nutri = cliente.post("/auth/login", json={"email": EMAIL_NUTRI_1, "senha": SENHA_PADRAO}).json()
    token_nutri = login_nutri["token"]
    headers = {"Authorization": f"Bearer {token_nutri}"}

    # Nutricionista acessa seu painel: Sucesso (200)
    resp_propria = cliente.get("/auth/nutricionista/meu-painel", headers=headers)
    assert resp_propria.status_code == 200

    # Nutricionista tenta acessar espaço de paciente: Proibido (403)
    resp_bloqueada = cliente.get("/auth/paciente/meu-espaco", headers=headers)
    assert resp_bloqueada.status_code == 403


# ------------------------------------------------------------------------------
# 5. TESTE DE AUTORIZAÇÃO DE DADOS ENTRE PACIENTES E VÍNCULO CLÍNICO
# ------------------------------------------------------------------------------

def test_protecao_dados_pacientes_e_vinculo():
    # Cadastra segundo paciente
    cliente.post("/auth/cadastro", json={
        "nome": "Segundo Paciente",
        "email": EMAIL_PACIENTE_2,
        "senha": SENHA_PADRAO,
        "tipo_usuario": "paciente"
    })

    # Cadastra nutricionista sem vínculo
    cliente.post("/auth/cadastro", json={
        "nome": "Nutricionista Sem Vínculo",
        "email": EMAIL_NUTRI_SEM_VINCULO,
        "senha": SENHA_PADRAO,
        "tipo_usuario": "nutricionista",
        "crn": "CRN-3 99999/P"
    })

    # Aprova o nutricionista para que a restrição testada seja especificamente a de vínculo clínico
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE usuarios SET status_aprovacao = 'aprovado' WHERE email = %s;", (EMAIL_NUTRI_SEM_VINCULO,))

    token_paciente_1 = cliente.post("/auth/login", json={"email": EMAIL_PACIENTE_1, "senha": SENHA_PADRAO}).json()["token"]
    token_nutri_sem_vinculo = cliente.post("/auth/login", json={"email": EMAIL_NUTRI_SEM_VINCULO, "senha": SENHA_PADRAO}).json()["token"]

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Obtém IDs da tabela pacientes
            cur.execute("""
                SELECT p.id, u.email 
                FROM pacientes p 
                JOIN usuarios u ON u.id = p.usuario_id 
                WHERE u.email IN (%s, %s);
            """, (EMAIL_PACIENTE_1, EMAIL_PACIENTE_2))
            linhas = dict(cur.fetchall())
            paciente_id_1 = [id_p for id_p, email in linhas.items() if email == EMAIL_PACIENTE_1][0]
            paciente_id_2 = [id_p for id_p, email in linhas.items() if email == EMAIL_PACIENTE_2][0]

    # 1. Paciente 1 acessa seus próprios dados: Sucesso (200)
    resp_p1_proprio = cliente.get(f"/pacientes/{paciente_id_1}/dados-clinicos", headers={"Authorization": f"Bearer {token_paciente_1}"})
    assert resp_p1_proprio.status_code == 200

    # 2. Paciente 1 tenta acessar dados do Paciente 2: Bloqueado (403)
    resp_p1_outro = cliente.get(f"/pacientes/{paciente_id_2}/dados-clinicos", headers={"Authorization": f"Bearer {token_paciente_1}"})
    assert resp_p1_outro.status_code == 403

    # 3. Nutricionista SEM vínculo tenta acessar dados do Paciente 1: Bloqueado (403)
    resp_nutri_sem_vinculo = cliente.get(f"/pacientes/{paciente_id_1}/dados-clinicos", headers={"Authorization": f"Bearer {token_nutri_sem_vinculo}"})
    assert resp_nutri_sem_vinculo.status_code == 403
    assert "vínculo" in resp_nutri_sem_vinculo.json()["detail"].lower()


# ------------------------------------------------------------------------------
# 6. TESTE DE PERSISTÊNCIA DO PAPEL VIA GET /auth/me
# ------------------------------------------------------------------------------

def test_persistencia_sessao_e_recuperacao_papel():
    token_paciente = cliente.post("/auth/login", json={"email": EMAIL_PACIENTE_1, "senha": SENHA_PADRAO}).json()["token"]

    resp_me = cliente.get("/auth/me", headers={"Authorization": f"Bearer {token_paciente}"})
    assert resp_me.status_code == 200
    corpo = resp_me.json()
    assert corpo["sucesso"] is True
    assert corpo["usuario"]["email"] == EMAIL_PACIENTE_1
    assert corpo["usuario"]["tipo_usuario"] == "paciente"
