# ==============================================================================
# SERVIÇO CENTRALIZADO DA OPENAI - WISHDIET
# ==============================================================================
# - Único ponto de comunicação com a OpenAI (chave só no backend).
# - Modelo por funcionalidade, configurável por variável de ambiente.
# - Structured Outputs (Responses API) validados por schema Pydantic.
# - store=False: não pede à OpenAI que guarde a resposta (não elimina o monitoramento
#   de uso da plataforma; ver seção 9.6 do relatório).
# - Registra tokens, custo e resultado em ia_uso_log (sem conteúdo clínico).
# ==============================================================================
 
import json
import logging
import os
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional, Type, TypeVar
 
import openai
from pydantic import BaseModel
 
log = logging.getLogger("wishdiet.ia")
 
T = TypeVar("T", bound=BaseModel)
 
 
class Funcionalidade(str, Enum):
    PLANO = "plano"
    EXAME = "exame"
    CHECKIN = "checkin"
 
 
@dataclass(frozen=True)
class ConfigModelo:
    env_var: str          # variável que sobrescreve o modelo
    padrao: str           # identificador padrão (CONFERIR na documentação da OpenAI)
    max_saida: int        # limite de tokens de saída
    preco_entrada: float  # US$ por 1M de tokens (CONFERIR; sobrescrevível por env)
    preco_saida: float
 
 
CONFIG: Dict[Funcionalidade, ConfigModelo] = {
    Funcionalidade.PLANO: ConfigModelo("OPENAI_MODEL_PLANO", "gpt-6.1-terra", 3000, 1.00, 5.00),
    Funcionalidade.EXAME: ConfigModelo("OPENAI_MODEL_EXAME", "gpt-6.1-sol", 4000, 2.00, 10.00),
    Funcionalidade.CHECKIN: ConfigModelo("OPENAI_MODEL_CHECKIN", "gpt-6-luna", 1200, 0.10, 0.50),
}
 
MENSAGENS_ERRO = {
    "nao_configurado": "O serviço de IA não está configurado no servidor.",
    "autenticacao": "O serviço de IA está indisponível no momento (credenciais).",
    "limite": "O serviço de IA atingiu o limite de requisições. Tente novamente em instantes.",
    "indisponivel": "O serviço de IA está temporariamente indisponível. Tente novamente em instantes.",
    "resposta_invalida": "A IA não retornou uma resposta válida. Tente novamente.",
    "erro_interno": "Não foi possível concluir a análise de IA.",
}
 
 
class IAIndisponivelError(Exception):
    """Falha segura (sem detalhes internos) ao usar a IA."""
 
    def __init__(self, codigo: str):
        self.codigo = codigo
        self.mensagem = MENSAGENS_ERRO.get(codigo, MENSAGENS_ERRO["erro_interno"])
        super().__init__(self.mensagem)
 
 
@dataclass
class ResultadoIA:
    dados: BaseModel
    modelo: str
    tokens_entrada: int
    tokens_saida: int
    custo_estimado_usd: float
 
 
_cliente: Optional[openai.OpenAI] = None
 
 
def _obter_cliente() -> openai.OpenAI:
    global _cliente
    if _cliente is None:
        chave = os.getenv("OPENAI_API_KEY", "").strip()
        if not chave:
            raise IAIndisponivelError("nao_configurado")
        _cliente = openai.OpenAI(api_key=chave, timeout=60.0, max_retries=2)
    return _cliente
 
 
def modelo_da_funcionalidade(funcionalidade: Funcionalidade) -> str:
    cfg = CONFIG[funcionalidade]
    return os.getenv(cfg.env_var, cfg.padrao).strip() or cfg.padrao
 
 
def _preco(funcionalidade: Funcionalidade) -> tuple:
    cfg = CONFIG[funcionalidade]
    sufixo = funcionalidade.value.upper()
    try:
        p_in = float(os.getenv(f"OPENAI_PRECO_ENTRADA_{sufixo}", cfg.preco_entrada))
        p_out = float(os.getenv(f"OPENAI_PRECO_SAIDA_{sufixo}", cfg.preco_saida))
    except ValueError:
        p_in, p_out = cfg.preco_entrada, cfg.preco_saida
    return p_in, p_out
 
 
def estimar_custo_usd(funcionalidade: Funcionalidade, tokens_entrada: int, tokens_saida: int) -> float:
    p_in, p_out = _preco(funcionalidade)
    return round((tokens_entrada * p_in + tokens_saida * p_out) / 1_000_000, 6)
 
 
def _classificar_erro(erro: Exception) -> str:
    if isinstance(erro, (openai.AuthenticationError, openai.PermissionDeniedError)):
        return "autenticacao"
    if isinstance(erro, openai.RateLimitError):
        return "limite"
    if isinstance(erro, (openai.APIConnectionError, openai.APITimeoutError, openai.InternalServerError)):
        return "indisponivel"
    return "erro_interno"
 
 
def _registrar_uso(*, usuario_id, paciente_id, funcionalidade, modelo, tokens_entrada,
                   tokens_saida, custo, duracao_ms, resultado, tipo_erro=None) -> None:
    """Grava o consumo. Nunca grava conteúdo clínico e nunca interrompe a operação."""
    try:
        from database import get_db_connection  # import tardio: facilita testes unitários
 
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ia_uso_log
                        (usuario_id, paciente_id, funcionalidade, modelo, tokens_entrada,
                         tokens_saida, custo_estimado_usd, duracao_ms, resultado, tipo_erro)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (usuario_id, paciente_id, funcionalidade.value, modelo, tokens_entrada,
                     tokens_saida, custo, duracao_ms, resultado, tipo_erro),
                )
    except Exception as erro:
        log.error("Falha ao registrar ia_uso_log: %s", type(erro).__name__)
 
 
def gerar_estruturado(
    *,
    funcionalidade: Funcionalidade,
    instrucoes: str,
    dados: Dict[str, Any],
    schema: Type[T],
    usuario_id: Optional[int] = None,
    paciente_id: Optional[int] = None,
) -> ResultadoIA:
    """
    Envia `dados` (já minimizados) à OpenAI e devolve a resposta validada pelo `schema`.
    Levanta IAIndisponivelError em qualquer falha (mensagem segura para o usuário).
    """
    cfg = CONFIG[funcionalidade]
    modelo = modelo_da_funcionalidade(funcionalidade)
    inicio = time.monotonic()
 
    def _duracao() -> int:
        return int((time.monotonic() - inicio) * 1000)
 
    def _falha(codigo: str, tin: int = 0, tout: int = 0) -> IAIndisponivelError:
        _registrar_uso(
            usuario_id=usuario_id, paciente_id=paciente_id, funcionalidade=funcionalidade,
            modelo=modelo, tokens_entrada=tin, tokens_saida=tout,
            custo=estimar_custo_usd(funcionalidade, tin, tout), duracao_ms=_duracao(),
            resultado="erro", tipo_erro=codigo,
        )
        return IAIndisponivelError(codigo)
 
    try:
        cliente = _obter_cliente()
        resposta = cliente.responses.parse(
            model=modelo,
            instructions=instrucoes,  # parte estável primeiro (cache de prompt)
            input=json.dumps(dados, ensure_ascii=False, separators=(",", ":"), default=str),
            text_format=schema,
            max_output_tokens=cfg.max_saida,
            store=False,
        )
    except IAIndisponivelError as erro:
        raise _falha(erro.codigo) from None
    except Exception as erro:
        # Loga só o tipo do erro: a mensagem pode conter trechos da requisição.
        log.warning("Falha na OpenAI (%s): %s", funcionalidade.value, type(erro).__name__)
        raise _falha(_classificar_erro(erro)) from None
 
    uso = getattr(resposta, "usage", None)
    tokens_in = int(getattr(uso, "input_tokens", 0) or 0)
    tokens_out = int(getattr(uso, "output_tokens", 0) or 0)
 
    parsed = getattr(resposta, "output_parsed", None)
    if parsed is None:  # recusa do modelo, resposta incompleta ou fora do schema
        raise _falha("resposta_invalida", tokens_in, tokens_out)
 
    custo = estimar_custo_usd(funcionalidade, tokens_in, tokens_out)
    _registrar_uso(
        usuario_id=usuario_id, paciente_id=paciente_id, funcionalidade=funcionalidade,
        modelo=modelo, tokens_entrada=tokens_in, tokens_saida=tokens_out, custo=custo,
        duracao_ms=_duracao(), resultado="sucesso",
    )
    return ResultadoIA(parsed, modelo, tokens_in, tokens_out, custo)