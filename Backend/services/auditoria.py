# REGISTRO DE AUDITORIA (SEM SENHAS, TOKENS OU CONTEÚDO CLÍNICO)
import logging
from typing import Optional
 
log = logging.getLogger("wishdiet.auditoria")
 
 
def registrar(usuario_id: Optional[int], acao: str, recurso: str,
              recurso_id: Optional[int] = None, resultado: str = "sucesso") -> None:
    """Melhor esforço: uma falha de auditoria não deve derrubar a requisição."""
    try:
        from database import get_db_connection
 
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO log_auditoria (usuario_id, acao, recurso, recurso_id, resultado)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (usuario_id, acao, recurso, recurso_id, resultado),
                )
    except Exception as erro:
        log.error("Falha ao registrar auditoria: %s", type(erro).__name__)
 