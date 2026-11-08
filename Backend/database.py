# ==============================================================================
# MÓDULO DE CONEXÃO COM O BANCO DE DADOS POSTGRESQL - WISHDIET
# ==============================================================================
# Este módulo centraliza a criação e o gerenciamento seguro de conexões
# com o banco de dados PostgreSQL utilizando o driver psycopg 3.
# ==============================================================================

import os
from contextlib import contextmanager
import psycopg
from dotenv import load_dotenv

# CARREGA AS VARIÁVEIS DE AMBIENTE (.env)
load_dotenv()

# CONFIGURAÇÃO DE PARÂMETROS DA CONEXÃO
def obter_config_banco():
    senha = os.getenv("DB_PASSWORD")
    if senha is None or senha == "":
        raise RuntimeError(
            "CONFIGURAÇÃO INSEGURA: A variável de ambiente DB_PASSWORD não está configurada. "
            "Defina uma senha segura para o banco de dados no arquivo .env."
        )

    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": os.getenv("DB_PORT", "5432"),
        "dbname": os.getenv("DB_NAME", "Wish_Diet_app"),
        "user": os.getenv("DB_USER", "postgres"),
        "password": senha,
        "connect_timeout": 5
    }

# GERENCIADOR DE CONTEXTO PARA CONEXÕES COM O POSTGRESQL
# Garante que a conexão seja aberta, as transações sejam confirmadas (commit)
# e fechadas adequadamente, revertendo alterações (rollback) em caso de erro.
@contextmanager
def get_db_connection():
    config = obter_config_banco()
    conexao = psycopg.connect(**config)
    try:
        yield conexao
        conexao.commit()
    except Exception:
        conexao.rollback()
        raise
    finally:
        conexao.close()
