# ==============================================================================
# MONTAGEM DO PAYLOAD MÍNIMO PARA A IA (MINIMIZAÇÃO DE DADOS - LGPD)
# ==============================================================================
# Regras: nunca enviar nome, e-mail, CPF, telefone, ids ou data de nascimento.
# Envia idade (calculada), medidas, IMC (calculado pelo Python), objetivo e
# restrições. Texto livre é opcional e passa por higienização básica.
# LIMITAÇÃO: a higienização remove e-mail, CPF e telefone, mas NÃO consegue
# remover nomes próprios de texto livre. Por isso observações ficam desligadas
# por padrão (incluir_observacoes=False).
# ==============================================================================
 
import re
from datetime import date
from typing import Any, Dict, List, Optional
from services.payload_ia import montar_payload_paciente
from funcoes_wishdiet import calcular_imc, classificar_imc
 
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_CPF = re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b")
_TELEFONE = re.compile(r"(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}")
 
_SEM_RESTRICAO = {"nenhuma", "nenhum", "não", "nao", "-", "n/a"}


def higienizar_texto(texto: Optional[str], limite: int = 500) -> Optional[str]:
    """Remove e-mail, CPF e telefone, normaliza espaços e limita o tamanho."""
    if not texto:
        return None
    t = str(texto)
    for padrao in (_EMAIL, _CPF, _TELEFONE):
        t = padrao.sub("[removido]", t)
    t = " ".join(t.split())
    return t[:limite] if t else None
 
 
def calcular_idade(data_nascimento: Optional[date], hoje: Optional[date] = None) -> Optional[int]:
    if not data_nascimento:
        return None
    hoje = hoje or date.today()
    idade = hoje.year - data_nascimento.year - (
        (hoje.month, hoje.day) < (data_nascimento.month, data_nascimento.day)
    )
    return idade if 0 <= idade <= 120 else None
 
 
def lista_restricoes(texto: Optional[str]) -> List[str]:
    """'Lactose, glúten' -> ['Lactose', 'glúten']; 'Nenhuma' -> []."""
    if not texto:
        return []
    itens = []
    for parte in re.split(r"[,;\n]+", str(texto)):
        limpo = higienizar_texto(parte, limite=80)
        if limpo and limpo.lower() not in _SEM_RESTRICAO:
            itens.append(limpo)
    return itens
 
 
def _numero_positivo(valor: Any) -> Optional[float]:
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None
 
 
def montar_payload_paciente(
    *,
    data_nascimento: Optional[date],
    peso_kg: Any,
    altura_cm: Any,
    objetivo: Optional[str],
    restricoes: Optional[str],
    observacoes: Optional[str] = None,
    incluir_observacoes: bool = False,
    hoje: Optional[date] = None,
) -> Dict[str, Any]:
    """Devolve apenas campos com valor, para economizar tokens."""
    peso = _numero_positivo(peso_kg)
    altura = _numero_positivo(altura_cm)
 
    imc = classificacao = None
    if peso and altura:
        imc_val = calcular_imc(peso, altura / 100)  # funcoes_wishdiet usa metros
        imc = round(imc_val, 2)
        classificacao = classificar_imc(imc_val)
 
    payload: Dict[str, Any] = {
        "idade": calcular_idade(data_nascimento, hoje),
        "peso_kg": peso,
        "altura_cm": altura,
        "imc": imc,
        "classificacao_imc": classificacao,
        "objetivo": higienizar_texto(objetivo, limite=200),
        "restricoes": lista_restricoes(restricoes),
    }
    if incluir_observacoes:
        payload["observacoes"] = higienizar_texto(observacoes)
 
    return {k: v for k, v in payload.items() if v not in (None, [], "")}
 