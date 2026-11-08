import os
import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
import jwt
from datetime import datetime, timedelta, timezone

from auth import (
    criar_token_acesso,
    decodificar_token_acesso,
    validar_credencial_google,
    JWT_SECRET,
    JWT_ALGORITHM,
    GOOGLE_CLIENT_IDS
)


# ==============================================================================
# 1. TESTES DE SEGURANÇA DO JWT
# ==============================================================================

def test_jwt_criacao_e_decodificacao_valida():
    """Valida a emissão e decodificação correta de um JWT autêntico."""
    token = criar_token_acesso(123, "teste@wishdiet.com", "paciente")
    payload = decodificar_token_acesso(token)
    assert payload["sub"] == "123"
    assert payload["email"] == "teste@wishdiet.com"
    assert payload["tipo_usuario"] == "paciente"
    assert "exp" in payload
    assert "iat" in payload


def test_jwt_expirado_rejeitado():
    """Garante que tokens expirados sejam rejeitados com HTTP 401."""
    expirado = datetime.now(timezone.utc) - timedelta(hours=1)
    payload_expirado = {
        "sub": "123",
        "email": "teste@wishdiet.com",
        "tipo_usuario": "paciente",
        "exp": expirado,
        "iat": datetime.now(timezone.utc) - timedelta(hours=2)
    }
    token_expirado = jwt.encode(payload_expirado, JWT_SECRET, algorithm=JWT_ALGORITHM)
    with pytest.raises(HTTPException) as exc_info:
        decodificar_token_acesso(token_expirado)
    assert exc_info.value.status_code == 401
    assert "expirado" in exc_info.value.detail.lower()


def test_jwt_sem_exp_rejeitado():
    """Garante que tokens sem o claim 'exp' sejam sumariamente rejeitados."""
    payload_sem_exp = {
        "sub": "123",
        "email": "teste@wishdiet.com",
        "tipo_usuario": "paciente"
    }
    token = jwt.encode(payload_sem_exp, JWT_SECRET, algorithm=JWT_ALGORITHM)
    with pytest.raises(HTTPException) as exc_info:
        decodificar_token_acesso(token)
    assert exc_info.value.status_code == 401


def test_jwt_sem_sub_rejeitado():
    """Garante que tokens sem o claim 'sub' sejam rejeitados com HTTP 401."""
    payload_sem_sub = {
        "email": "teste@wishdiet.com",
        "tipo_usuario": "paciente",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }
    token_invalido = jwt.encode(payload_sem_sub, JWT_SECRET, algorithm=JWT_ALGORITHM)
    with pytest.raises(HTTPException) as exc_info:
        decodificar_token_acesso(token_invalido)
    assert exc_info.value.status_code == 401
    assert "inválido" in exc_info.value.detail.lower()


def test_jwt_com_sub_nao_numerico_rejeitado():
    """Garante que tokens cujo 'sub' não seja numérico sejam rejeitados com HTTP 401."""
    payload = {
        "sub": "usuario_admin_fake",
        "email": "teste@wishdiet.com",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    with pytest.raises(HTTPException) as exc_info:
        decodificar_token_acesso(token)
    assert exc_info.value.status_code == 401
    assert "inválido" in exc_info.value.detail.lower()


def test_jwt_com_sub_zero_ou_negativo_rejeitado():
    """Garante que identificador de usuário <= 0 seja rejeitado com HTTP 401."""
    for sub_invalido in ["0", "-5"]:
        payload = {
            "sub": sub_invalido,
            "email": "teste@wishdiet.com",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1)
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        with pytest.raises(HTTPException) as exc_info:
            decodificar_token_acesso(token)
        assert exc_info.value.status_code == 401
        assert "inválido" in exc_info.value.detail.lower()


def test_jwt_assinatura_invalida_rejeitado():
    """Garante que assinaturas geradas com chave diferente sejam rejeitadas."""
    token_falso = jwt.encode(
        {"sub": "123", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        "outra_chave_com_tamanho_seguro_para_testes_32_chars!",
        algorithm="HS256"
    )
    with pytest.raises(HTTPException) as exc_info:
        decodificar_token_acesso(token_falso)
    assert exc_info.value.status_code == 401
    assert "inválido" in exc_info.value.detail.lower()


def test_jwt_algoritmo_nao_autorizado_rejeitado():
    """Garante que tokens assinados com algoritmo diferente de HS256 sejam rejeitados."""
    # Simula token 'none' (sem assinatura)
    token_none = jwt.encode(
        {"sub": "123", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        key="",
        algorithm="none"
    )
    with pytest.raises(HTTPException) as exc_info:
        decodificar_token_acesso(token_none)
    assert exc_info.value.status_code == 401


def test_jwt_token_malformado_rejeitado():
    """Garante que strings corrompidas ou malformadas resultem em HTTP 401 sem quebrar o servidor."""
    with pytest.raises(HTTPException) as exc_info:
        decodificar_token_acesso("isso.nao.eh.um.jwt")
    assert exc_info.value.status_code == 401
    assert "inválido" in exc_info.value.detail.lower()


# ==============================================================================
# 2. TESTES DE SEGURANÇA DO GOOGLE OAUTH 2.0 (MOCKS DO VERIFICADOR OFICIAL)
# ==============================================================================

def test_google_token_vazio_rejeitado():
    """Rejeita token vazio com HTTP 400."""
    with pytest.raises(HTTPException) as exc_info:
        validar_credencial_google("")
    assert exc_info.value.status_code == 400


def test_google_token_falso_sem_assinatura_rejeitado():
    """Rejeita token inválido com HTTP 401 sem expor erros internos."""
    with pytest.raises(HTTPException) as exc_info:
        validar_credencial_google("token_sintetico_invalido_sem_assinatura")
    assert exc_info.value.status_code == 401


def test_google_sem_client_ids_configurados():
    """Falha com HTTP 500 se o servidor não tiver GOOGLE_CLIENT_IDS configurados."""
    import auth
    client_ids_backup = auth.GOOGLE_CLIENT_IDS
    try:
        auth.GOOGLE_CLIENT_IDS = []
        with pytest.raises(HTTPException) as exc_info:
            validar_credencial_google("qualquer_token")
        assert exc_info.value.status_code == 500
        assert "não configurada" in exc_info.value.detail.lower()
    finally:
        auth.GOOGLE_CLIENT_IDS = client_ids_backup


@patch("google.oauth2.id_token.verify_oauth2_token")
def test_google_audiencia_incorreta_rejeitado(mock_verify):
    """Rejeita token emitido para outro client_id (outro app) com HTTP 401."""
    mock_verify.return_value = {
        "iss": "accounts.google.com",
        "aud": "cliente_malicioso_de_outro_app.apps.googleusercontent.com",
        "sub": "google_123456",
        "email": "user@gmail.com",
        "email_verified": True
    }
    with pytest.raises(HTTPException) as exc_info:
        validar_credencial_google("token_com_aud_estranha")
    assert exc_info.value.status_code == 401


@patch("google.oauth2.id_token.verify_oauth2_token")
def test_google_emissor_incorreto_rejeitado(mock_verify):
    """Rejeita token com emissor que não seja accounts.google.com."""
    import auth
    client_id_valido = auth.GOOGLE_CLIENT_IDS[0] if auth.GOOGLE_CLIENT_IDS else "app_id_teste"
    mock_verify.return_value = {
        "iss": "https://emissor-falso.com",
        "aud": client_id_valido,
        "sub": "google_123456",
        "email": "user@gmail.com",
        "email_verified": True
    }
    with pytest.raises(HTTPException) as exc_info:
        validar_credencial_google("token_com_iss_falso")
    assert exc_info.value.status_code == 401


@patch("google.oauth2.id_token.verify_oauth2_token")
def test_google_email_nao_verificado_rejeitado(mock_verify):
    """Rejeita token Google se email_verified não for True."""
    import auth
    client_id_valido = auth.GOOGLE_CLIENT_IDS[0] if auth.GOOGLE_CLIENT_IDS else "app_id_teste"
    mock_verify.return_value = {
        "iss": "accounts.google.com",
        "aud": client_id_valido,
        "sub": "google_123456",
        "email": "user@gmail.com",
        "email_verified": False
    }
    with pytest.raises(HTTPException) as exc_info:
        validar_credencial_google("token_email_nao_verificado")
    assert exc_info.value.status_code == 401


@patch("google.oauth2.id_token.verify_oauth2_token")
def test_google_validacao_com_sucesso_e_normalizacao(mock_verify):
    """Verifica que token Google válido é aceito e o e-mail é normalizado para minúsculas."""
    import auth
    client_id_valido = auth.GOOGLE_CLIENT_IDS[0] if auth.GOOGLE_CLIENT_IDS else "app_id_teste"
    mock_verify.return_value = {
        "iss": "https://accounts.google.com",
        "aud": client_id_valido,
        "sub": "9876543210",
        "email": "Paciente.WishDiet@GMAIL.COM",
        "name": "Paciente Teste",
        "email_verified": True
    }
    resultado = validar_credencial_google("token_google_valido")
    assert resultado["google_id"] == "9876543210"
    assert resultado["email"] == "paciente.wishdiet@gmail.com"
    assert resultado["nome"] == "Paciente Teste"
