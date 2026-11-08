# ==============================================================================
# MÓDULO DE AUTENTICAÇÃO, HASHING E AUTORIZAÇÃO DE PAPÉIS - WISHDIET
# ==============================================================================
# Este módulo gerencia o ciclo de vida de autenticação dos usuários:
# - Criptografia forte de senhas com bcrypt (salting automático)
# - Emissão e validação de tokens JWT próprios da aplicação
# - Validação de tokens de identidade do Google (OAuth 2.0 / OpenID Connect)
# - Middleware e dependências FastAPI para controle estrito de papéis (RBAC)
# ==============================================================================

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from database import get_db_connection
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from dotenv import load_dotenv

# Garante o carregamento das variáveis de ambiente caso auth.py seja importado diretamente
load_dotenv()

# CONFIGURAÇÕES DO TOKEN JWT
JWT_SECRET_RAW = os.getenv("JWT_SECRET")
if not JWT_SECRET_RAW or len(JWT_SECRET_RAW.strip()) < 32:
    raise RuntimeError(
        "CONFIGURAÇÃO INSEGURA: A variável de ambiente JWT_SECRET deve ser configurada "
        "com no mínimo 32 caracteres seguros para garantir a integridade da aplicação."
    )
JWT_SECRET: str = JWT_SECRET_RAW.strip()

# O algoritmo utilizado pela aplicação é fixo e restrito a HS256
JWT_ALGORITHM: str = "HS256"

try:
    JWT_EXPIRACAO_HORAS = int(os.getenv("JWT_EXPIRACAO_HORAS", "24"))
    if JWT_EXPIRACAO_HORAS <= 0:
        raise ValueError()
except ValueError:
    raise RuntimeError(
        "CONFIGURAÇÃO INVÁLIDA: A variável JWT_EXPIRACAO_HORAS deve ser um número inteiro positivo."
    )

GOOGLE_CLIENT_IDS = [c.strip() for c in os.getenv("GOOGLE_CLIENT_IDS", "").split(",") if c.strip()]

# ESQUEMA DE SEGURANÇA HTTP BEARER PARA ENDPOINTS PROTEGIDOS
security = HTTPBearer(auto_error=False)


# ------------------------------------------------------------------------------
# 1. FUNÇÕES DE CRIPTOGRAFIA DE SENHA (BCRYPT)
# ------------------------------------------------------------------------------

def gerar_hash_senha(senha_plana: str) -> str:
    """
    Gera um hash criptográfico seguro da senha utilizando bcrypt com salt aleatório.
    Nunca armazena nem retorna senhas em texto puro.
    """
    if not senha_plana or len(senha_plana.strip()) < 6:
        raise ValueError("A senha deve conter no mínimo 6 caracteres.")
    
    salt = bcrypt.gensalt(rounds=12)
    hash_bytes = bcrypt.hashpw(senha_plana.encode("utf-8"), salt)
    return hash_bytes.decode("utf-8")


def verificar_senha(senha_plana: str, hash_armazenado: Optional[str]) -> bool:
    """
    Compara uma senha informada com o hash salvo no PostgreSQL de forma segura
    contra ataques de tempo (timing attacks).
    """
    if not hash_armazenado or not senha_plana:
        return False
    try:
        return bcrypt.checkpw(senha_plana.encode("utf-8"), hash_armazenado.encode("utf-8"))
    except Exception:
        return False


# ------------------------------------------------------------------------------
# 2. EMISSÃO E VERIFICAÇÃO DE TOKENS JWT
# ------------------------------------------------------------------------------

def criar_token_acesso(usuario_id: int, email: str, tipo_usuario: str) -> str:
    """
    Gera o token JWT próprio da aplicação WishDiet contendo a identidade e o papel do usuário.
    """
    expiracao = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRACAO_HORAS)
    payload = {
        "sub": str(usuario_id),
        "email": email,
        "tipo_usuario": tipo_usuario,
        "exp": expiracao,
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decodificar_token_acesso(token: str) -> Dict[str, Any]:
    """
    Decodifica e valida a assinatura e data de expiração do token JWT.
    Exige obrigatoriamente os claims 'exp' e 'sub'.
    Valida se 'sub' representa um identificador numérico positivo.
    """
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub"]}
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acesso expirado. Por favor, realize o login novamente."
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação inválido."
        )

    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação inválido: identificador ausente."
        )

    try:
        sub_str = str(sub).strip()
        # Verifica se é estritamente numérico e positivo
        if not sub_str.isdigit() or int(sub_str) <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação inválido: identificador de usuário inválido."
        )

    return payload


# ------------------------------------------------------------------------------
# 3. VALIDAÇÃO DE IDENTIDADE DO GOOGLE 
# ------------------------------------------------------------------------------

def validar_credencial_google(id_token: str) -> Dict[str, Any]:
    """
    Valida o Google ID Token contra as chaves públicas oficiais do Google via google-auth.
    Exige obrigatoriamente GOOGLE_CLIENT_IDS configurado no ambiente.
    Verifica criptograficamente:
    - Assinatura criptográfica
    - Expiração
    - Emissor oficial ('accounts.google.com' ou 'https://accounts.google.com')
    - Audiência (deve pertencer aos Client IDs autorizados no backend)
    - Identificador Google ('sub')
    - E-mail e status email_verified == True
    """
    if not id_token or not id_token.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token do Google ausente ou inválido."
        )

    if not GOOGLE_CLIENT_IDS:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Autenticação com Google não configurada no servidor (GOOGLE_CLIENT_IDS ausente)."
        )

    try:
        request_adapter = google_requests.Request()
        dados = google_id_token.verify_oauth2_token(
            id_token.strip(),
            request_adapter,
            audience=None
        )

        aud = dados.get("aud")
        if not aud or aud not in GOOGLE_CLIENT_IDS:
            raise ValueError("Token emitido para uma audiência não autorizada.")

        iss = dados.get("iss")
        if iss not in ("accounts.google.com", "https://accounts.google.com"):
            raise ValueError("Emissor do token inválido.")

        google_sub = dados.get("sub")
        if not google_sub or not str(google_sub).strip():
            raise ValueError("Identificador Google (sub) ausente.")

        email = dados.get("email")
        if not email or "@" not in email:
            raise ValueError("E-mail ausente ou inválido no token Google.")

        email_verified = dados.get("email_verified")
        if email_verified is not True:
            raise ValueError("E-mail não verificado na conta Google.")

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não foi possível validar a credencial do Google. Token inválido, expirado ou não autorizado."
        )

    email_normalizado = email.strip().lower()

    return {
        "google_id": str(google_sub).strip(),
        "email": email_normalizado,
        "nome": (dados.get("name") or email_normalizado.split("@")[0]).strip(),
    }


# ------------------------------------------------------------------------------
# 4. DEPENDÊNCIAS DE AUTORIZAÇÃO E VALIDAÇÃO DE PAPÉIS (FASTAPI DEPENDS)
# ------------------------------------------------------------------------------

async def obter_usuario_atual(
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    """
    Extrai o token Bearer do cabeçalho da requisição, recupera o usuário correspondente
    no PostgreSQL e valida se a conta está ativa.
    """
    if not credenciais or not credenciais.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária. Token de acesso não fornecido."
        )

    payload = decodificar_token_acesso(credenciais.credentials)
    usuario_id = int(payload["sub"])

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, nome, email, tipo_usuario, ativo, status_aprovacao, crn, codigo_vinculo
                FROM usuarios
                WHERE id = %s;
            """, (usuario_id,))
            resultado = cur.fetchone()

            if not resultado:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Usuário associado a este token não foi encontrado."
                )

            usuario = {
                "id": resultado[0],
                "nome": resultado[1],
                "email": resultado[2],
                "tipo_usuario": resultado[3],
                "ativo": resultado[4],
                "status_aprovacao": resultado[5],
                "crn": resultado[6],
                "codigo_vinculo": resultado[7] if len(resultado) > 7 else None
            }

            if not usuario["ativo"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Esta conta de usuário foi desativada pelo administrador."
                )

            return usuario


async def exigir_paciente(usuario: Dict[str, Any] = Depends(obter_usuario_atual)) -> Dict[str, Any]:
    """
    Dependência FastAPI: restringe o acesso estritamente a usuários com papel 'paciente'.
    """
    if usuario["tipo_usuario"] != "paciente":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: Este recurso é restrito exclusivamente a pacientes."
        )
    return usuario




async def exigir_nutricionista(usuario: Dict[str, Any] = Depends(obter_usuario_atual)) -> Dict[str, Any]:
    """
    Dependência FastAPI: restringe o acesso estritamente a nutricionistas aprovados.
    Impede que o usuário obtenha permissão modificando requisições no aplicativo.
    """
    if usuario["tipo_usuario"] != "nutricionista":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: Este recurso é restrito exclusivamente a nutricionistas."
        )
    
    # Mecanismo de aprovação/validação profissional antes da liberação
    if usuario.get("status_aprovacao") != "aprovado":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sua conta de nutricionista está com cadastro em análise profissional (status pendente)."
        )
    return usuario


def verificar_vinculo_nutricionista_paciente(nutricionista_usuario_id: int, paciente_id: int) -> bool:
    """
    Verifica se um nutricionista possui vínculo clínico ATIVO com o paciente especificado.
    Evita que um nutricionista consulte dados de pacientes de terceiros.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 1 
                FROM vinculos_nutricionistas
                WHERE nutricionista_id = %s AND paciente_id = %s AND ativo = TRUE;
            """, (nutricionista_usuario_id, paciente_id))
            return cur.fetchone() is not None
