import io
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app
from auth import criar_token_acesso

client = TestClient(app)

# ------------------------------------------------------------------------------
# 1. TESTES DA ROTA /analise
# ------------------------------------------------------------------------------

def test_analise_sem_identificador():
    token = criar_token_acesso(1, "paciente@teste.com", "paciente")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("auth.get_db_connection") as mock_auth_conn:
        mock_auth_cur = mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_auth_cur.fetchone.return_value = (1, "Paciente", "paciente@teste.com", "paciente", True, "aprovado", None, None)
        
        # Sem id ou paciente_id
        resp = client.post("/analise", json={"nome": "Teste"}, headers=headers)
        assert resp.status_code == 400
        assert "Identificador do paciente" in resp.json()["detail"]


def test_analise_identificador_invalido():
    token = criar_token_acesso(1, "paciente@teste.com", "paciente")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("auth.get_db_connection") as mock_auth_conn:
        mock_auth_cur = mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_auth_cur.fetchone.return_value = (1, "Paciente", "paciente@teste.com", "paciente", True, "aprovado", None, None)
        
        # ID texto não conversível
        resp1 = client.post("/analise", json={"id": "abc"}, headers=headers)
        assert resp1.status_code == 400
        assert "inválido" in resp1.json()["detail"].lower()
        
        # ID <= 0
        resp2 = client.post("/analise", json={"id": -5}, headers=headers)
        assert resp2.status_code == 400
        assert "inválido" in resp2.json()["detail"].lower()

        # ID booleano
        resp3 = client.post("/analise", json={"id": True}, headers=headers)
        assert resp3.status_code == 400
        assert "inválido" in resp3.json()["detail"].lower()

        # ID string com decimal
        resp4 = client.post("/analise", json={"id": "10.9"}, headers=headers)
        assert resp4.status_code == 400
        assert "inválido" in resp4.json()["detail"].lower()


def test_analise_id_decimal_rejeitado():
    """Cenário 1: ID decimal (ex: 10.9) como float JSON deve ser rejeitado com HTTP 400."""
    token = criar_token_acesso(1, "paciente@teste.com", "paciente")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("auth.get_db_connection") as mock_auth_conn:
        mock_auth_cur = mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_auth_cur.fetchone.return_value = (1, "Paciente", "paciente@teste.com", "paciente", True, "aprovado", None, None)
        
        resp = client.post("/analise", json={"id": 10.9}, headers=headers)
        assert resp.status_code == 400
        assert "inválido" in resp.json()["detail"].lower()


def test_analise_paciente_inexistente():
    """Cenário 2: Paciente não encontrado no banco retorna HTTP 404."""
    token = criar_token_acesso(1, "paciente@teste.com", "paciente")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("auth.get_db_connection") as mock_auth_conn:
        mock_auth_cur = mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_auth_cur.fetchone.return_value = (1, "Paciente", "paciente@teste.com", "paciente", True, "aprovado", None, None)
        
        with patch("main.get_db_connection") as mock_conn:
            mock_cur = mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
            mock_cur.fetchone.return_value = None  # Paciente não existe
            
            resp = client.post("/analise", json={"id": 999}, headers=headers)
            assert resp.status_code == 404
            assert "Paciente não encontrado" in resp.json()["detail"]


def test_analise_paciente_tentando_analisar_outro():
    token = criar_token_acesso(1, "paciente1@teste.com", "paciente")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("auth.get_db_connection") as mock_auth_conn:
        mock_auth_cur = mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_auth_cur.fetchone.return_value = (1, "Paciente", "paciente1@teste.com", "paciente", True, "aprovado", None, None)
        
        # Mock do banco para retornar paciente pertencente ao usuário 999
        with patch("main.get_db_connection") as mock_conn:
            mock_cur = mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
            mock_cur.fetchone.return_value = (10, 999) # paciente_id=10, usuario_id=999
            
            resp = client.post("/analise", json={"id": 10}, headers=headers)
            assert resp.status_code == 403
            assert "permissão para analisar dados de outro paciente" in resp.json()["detail"]


def test_analise_paciente_proprio_registro_sucesso():
    """Cenário 3: Paciente acessando a própria análise com autorização válida."""
    token = criar_token_acesso(1, "paciente@teste.com", "paciente")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("auth.get_db_connection") as mock_auth_conn:
        mock_auth_cur = mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_auth_cur.fetchone.return_value = (1, "Paciente", "paciente@teste.com", "paciente", True, "aprovado", None, None)
        
        with patch("main.get_db_connection") as mock_conn:
            mock_cur = mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
            mock_cur.fetchone.return_value = (10, 1) # paciente_id=10, usuario_id=1 (o próprio paciente)
            
            resp = client.post(
                "/analise",
                json={
                    "id": 10,
                    "nome": "Paciente Teste",
                    "idade": 25,
                    "peso": 70,
                    "altura": 175,
                    "objetivo": "Saúde",
                    "restricoes": "Nenhuma"
                },
                headers=headers
            )
            assert resp.status_code == 200
            assert "analise" in resp.json()
            assert resp.json()["paciente"]["id"] == 10


def test_analise_nutricionista_pendente():
    token = criar_token_acesso(2, "nutri@teste.com", "nutricionista")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("auth.get_db_connection") as mock_auth_conn:
        mock_auth_cur = mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_auth_cur.fetchone.return_value = (2, "Nutri", "nutri@teste.com", "nutricionista", True, "pendente", "CRN-1234", None)
        
        with patch("main.get_db_connection") as mock_conn:
            mock_cur = mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
            mock_cur.fetchone.return_value = (10, 50)
            
            resp = client.post("/analise", json={"id": 10}, headers=headers)
            assert resp.status_code == 403
            assert "pendente" in resp.json()["detail"].lower()


def test_analise_nutricionista_sem_vinculo():
    token = criar_token_acesso(2, "nutri@teste.com", "nutricionista")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("auth.get_db_connection") as mock_auth_conn:
        mock_auth_cur = mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_auth_cur.fetchone.return_value = (2, "Nutri", "nutri@teste.com", "nutricionista", True, "aprovado", "CRN-1234", None)
        
        with patch("main.get_db_connection") as mock_conn:
            mock_cur = mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
            mock_cur.fetchone.return_value = (10, 50)
            
            with patch("main.verificar_vinculo_nutricionista_paciente", return_value=False):
                resp = client.post("/analise", json={"id": 10}, headers=headers)
                assert resp.status_code == 403
                assert "vínculo clínico ativo" in resp.json()["detail"]


def test_analise_nutricionista_aprovado_com_vinculo_sucesso():
    """Cenário 4: Nutricionista aprovado com vínculo ativo realizando análise autorizada."""
    token = criar_token_acesso(2, "nutri@teste.com", "nutricionista")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("auth.get_db_connection") as mock_auth_conn:
        mock_auth_cur = mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_auth_cur.fetchone.return_value = (2, "Nutri", "nutri@teste.com", "nutricionista", True, "aprovado", "CRN-1234", None)
        
        with patch("main.get_db_connection") as mock_conn:
            mock_cur = mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
            mock_cur.fetchone.return_value = (10, 50)
            
            with patch("main.verificar_vinculo_nutricionista_paciente", return_value=True):
                resp = client.post(
                    "/analise",
                    json={
                        "id": 10,
                        "nome": "Paciente Do Nutri",
                        "idade": 30,
                        "peso": 80,
                        "altura": 180,
                        "objetivo": "Hipertrofia",
                        "restricoes": "Glúten"
                    },
                    headers=headers
                )
                assert resp.status_code == 200
                assert "analise" in resp.json()
                assert resp.json()["paciente"]["id"] == 10


# ------------------------------------------------------------------------------
# 2. TESTES DA ROTA /pacientes/{id}/dados-clinicos
# ------------------------------------------------------------------------------

def test_dados_clinicos_papel_nao_autorizado():
    token = criar_token_acesso(3, "outro@teste.com", "visitante")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("auth.get_db_connection") as mock_auth_conn:
        mock_auth_cur = mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_auth_cur.fetchone.return_value = (3, "Outro", "outro@teste.com", "visitante", True, "aprovado", None, None)
        
        with patch("main.get_db_connection") as mock_conn:
            mock_cur = mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
            mock_cur.fetchone.return_value = (10, 50, "Emagrecer", "Nenhuma")
            
            resp = client.get("/pacientes/10/dados-clinicos", headers=headers)
            assert resp.status_code == 403
            assert "Perfil de usuário não autorizado" in resp.json()["detail"]


# ------------------------------------------------------------------------------
# 3. TESTES DE UPLOAD DE EXAME (LEITURA EM CHUNKS, ISOLAMENTO E PERMISSÕES)
# ------------------------------------------------------------------------------

@pytest.mark.parametrize("endpoint", ["/analise-exame", "/analisar-exame"])
def test_upload_exame_acima_do_limite_10mb(endpoint):
    """Cenário 5: Upload de arquivo acima de 10 MB retorna HTTP 413 imediatamente via chunking."""
    token = criar_token_acesso(1, "paciente@teste.com", "paciente")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("auth.get_db_connection") as mock_auth_conn:
        mock_auth_cur = mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_auth_cur.fetchone.return_value = (1, "Paciente", "paciente@teste.com", "paciente", True, "aprovado", None, None)
        
        # Cria gerador/buffer excedendo 10 MB (10 MB + 1 KB)
        tamanho_excedente = (10 * 1024 * 1024) + 1024
        # Não precisa alocar array gigante em RAM; BytesIO com seek
        conteudo_excedente = b"%PDF" + (b"0" * (tamanho_excedente - 4))
        files = {"arquivo": ("grande.pdf", io.BytesIO(conteudo_excedente), "application/pdf")}
        
        with patch("main.get_db_connection") as mock_conn:
            mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value.fetchone.return_value = (10,)
            with patch("main.extrair_texto_pdf") as mock_extrair:
                resp = client.post(endpoint, files=files, headers=headers)
            assert resp.status_code == 413
            assert "10 mb" in resp.json()["detail"].lower()
            mock_extrair.assert_not_called()


@pytest.mark.parametrize("endpoint", ["/analise-exame", "/analisar-exame"])
def test_upload_exame_assinatura_invalida(endpoint):
    """Cenário 6: Upload de arquivo que não começa com %PDF retorna HTTP 415."""
    token = criar_token_acesso(1, "paciente@teste.com", "paciente")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("auth.get_db_connection") as mock_auth_conn:
        mock_auth_cur = mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_auth_cur.fetchone.return_value = (1, "Paciente", "paciente@teste.com", "paciente", True, "aprovado", None, None)
        
        conteudo_falso = b"ARQUIVO_TXT_DISFARCADO_DE_PDF"
        files = {"arquivo": ("teste.pdf", io.BytesIO(conteudo_falso), "application/pdf")}
        
        with patch("main.get_db_connection") as mock_conn:
            mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value.fetchone.return_value = (10,)
            with patch("main.extrair_texto_pdf") as mock_extrair:
                resp = client.post(endpoint, files=files, headers=headers)
            assert resp.status_code == 415
            assert "não é um pdf válido" in resp.json()["detail"].lower()
            mock_extrair.assert_not_called()


@pytest.mark.parametrize("endpoint", ["/analise-exame", "/analisar-exame"])
def test_upload_exame_nutricionista_pendente(endpoint):
    """Cenário 7/8: Nutricionista pendente é bloqueado sem extrair o PDF."""
    token = criar_token_acesso(2, "nutri@teste.com", "nutricionista")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("auth.get_db_connection") as mock_auth_conn:
        mock_auth_cur = mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_auth_cur.fetchone.return_value = (2, "Nutri", "nutri@teste.com", "nutricionista", True, "pendente", "CRN-1234", None)
        
        pdf_conteudo = b"%PDF-1.4 exame fake"
        files = {"arquivo": ("exame.pdf", io.BytesIO(pdf_conteudo), "application/pdf")}
        data = {"paciente_id": 10}
        
        with patch("main.extrair_texto_pdf") as mock_extrair:
            resp = client.post(endpoint, files=files, data=data, headers=headers)
            assert resp.status_code == 403
            assert "pendente" in resp.json()["detail"].lower()
            mock_extrair.assert_not_called()


@pytest.mark.parametrize("endpoint", ["/analise-exame", "/analisar-exame"])
def test_upload_exame_nutricionista_sem_vinculo(endpoint):
    """Cenário 7/8: Nutricionista sem vínculo é bloqueado sem extrair o PDF."""
    token = criar_token_acesso(2, "nutri@teste.com", "nutricionista")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("auth.get_db_connection") as mock_auth_conn:
        mock_auth_cur = mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_auth_cur.fetchone.return_value = (2, "Nutri", "nutri@teste.com", "nutricionista", True, "aprovado", "CRN-1234", None)
        
        with patch("main.get_db_connection") as mock_conn:
            mock_cur = mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
            mock_cur.fetchone.return_value = None  # Sem vínculo no banco
            
            pdf_conteudo = b"%PDF-1.4 exame fake"
            files = {"arquivo": ("exame.pdf", io.BytesIO(pdf_conteudo), "application/pdf")}
            data = {"paciente_id": 10}
            
            with patch("main.extrair_texto_pdf") as mock_extrair:
                resp = client.post(endpoint, files=files, data=data, headers=headers)
                assert resp.status_code == 403
                assert "vínculo ativo" in resp.json()["detail"].lower()
                mock_extrair.assert_not_called()


@pytest.mark.parametrize("endpoint", ["/analise-exame", "/analisar-exame"])
def test_upload_exame_usuario_autorizado_sucesso_com_tmp_dir(endpoint, tmp_path):
    """Cenário 8 e Requisito 4: Sucesso no upload com isolamento estrito via tmp_path."""
    token = criar_token_acesso(1, "paciente@teste.com", "paciente")
    headers = {"Authorization": f"Bearer {token}"}
    
    with patch("auth.get_db_connection") as mock_auth_conn:
        mock_auth_cur = mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        mock_auth_cur.fetchone.return_value = (1, "Paciente", "paciente@teste.com", "paciente", True, "aprovado", None, None)
        
        with patch("main.get_db_connection") as mock_conn:
            mock_cur = mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
            mock_cur.fetchone.side_effect = [(10,), (100,)]
            
            pdf_conteudo = b"%PDF-1.4 conteudo de teste de exame valido"
            files = {"arquivo": ("exame.pdf", io.BytesIO(pdf_conteudo), "application/pdf")}
            
            fake_extracao = {
                "sucesso": True,
                "mensagem": "Texto extraído com sucesso",
                "total_paginas": 1,
                "texto_extraido": "Glicose: 90 mg/dL",
                "paginas": [{"numero": 1, "texto": "Glicose: 90 mg/dL"}],
                "alertas": []
            }
            # Redireciona STORAGE_DIR para o diretório temporário do teste
            with patch("main.STORAGE_DIR", tmp_path):
                with patch("main.extrair_texto_pdf", return_value=fake_extracao) as mock_extrair:
                    resp = client.post(endpoint, files=files, headers=headers)
                    assert resp.status_code == 200
                    assert resp.json()["sucesso"] is True
                    assert resp.json()["exame_id"] == 100
                    mock_extrair.assert_called_once()
                    
                    # Confirma que o arquivo foi salvo no tmp_path isolado e não na pasta real
                    arquivos_salvos = list(tmp_path.glob("*.pdf"))
                    assert len(arquivos_salvos) == 1
                    assert arquivos_salvos[0].read_bytes() == pdf_conteudo
