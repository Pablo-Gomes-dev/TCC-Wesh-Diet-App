# CONSENTIMENTO PARA PROCESSAMENTO POR IA (LGPD) - WISHDIET
# O paciente consente; qualquer uso de IA sobre dados dele (por ele ou pelo
# nutricionista vinculado) exige consentimento vigente na versão atual do texto.
from fastapi import HTTPException, status
from database import get_db_connection
 
FINALIDADE_IA = "ia_processamento"
VERSAO_TEXTO_IA = "1.0"
 
# ATENÇÃO: texto provisório. Deve ser revisado por assessoria jurídica / encarregado (DPO)
# antes de produção. Ao alterá-lo, incremente VERSAO_TEXTO_IA (isso exige novo aceite).
TEXTO_IA = (
    "O WishDiet usa inteligência artificial para apoiar seu nutricionista na elaboração de "
    "planos alimentares, na análise de exames laboratoriais e no acompanhamento da sua "
    "evolução. Para isso, dados de saúde seus (como medidas, objetivo, restrições alimentares, "
    "resultados de exames e check-ins) serão enviados, apenas no mínimo necessário e sem seu "
    "nome, a um provedor de IA contratado (OpenAI), que pode estar fora do Brasil. Os "
    "resultados são informações de apoio, revisadas pelo seu nutricionista, e não substituem "
    "a avaliação profissional. Você pode revogar este consentimento a qualquer momento nas "
    "configurações; a revogação não afeta o que já foi processado."
)
 
 
def consentimento_vigente(usuario_id: int) -> bool:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT concedido, versao_texto FROM consentimentos
                WHERE usuario_id = %s AND finalidade = %s
                ORDER BY registrado_em DESC, id DESC LIMIT 1
                """,
                (usuario_id, FINALIDADE_IA),
            )
            reg = cur.fetchone()
    return bool(reg and reg[0] is True and reg[1] == VERSAO_TEXTO_IA)
 
 
def registrar_consentimento(usuario_id: int, concedido: bool) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO consentimentos (usuario_id, finalidade, versao_texto, concedido)
                VALUES (%s, %s, %s, %s)
                """,
                (usuario_id, FINALIDADE_IA, VERSAO_TEXTO_IA, concedido),
            )
 
 
def paciente_consentiu_ia(paciente_id: int) -> bool:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT usuario_id FROM pacientes WHERE id = %s;", (paciente_id,))
            reg = cur.fetchone()
    return bool(reg) and consentimento_vigente(reg[0])
 
 
def exigir_consentimento_ia(paciente_id: int) -> None:
    """Chame antes de qualquer envio de dados do paciente à IA."""
    if not paciente_consentiu_ia(paciente_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "codigo": "CONSENTIMENTO_IA_AUSENTE",
                "mensagem": "O paciente ainda não autorizou o uso de IA sobre seus dados.",
            },
        )