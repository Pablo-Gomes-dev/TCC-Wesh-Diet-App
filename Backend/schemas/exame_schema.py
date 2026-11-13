# SCHEMA DE RESPOSTA ESTRUTURADA - RELATÓRIO DE EXAMES (GPT-6.1 Sol)
from typing import List, Literal, Optional
from pydantic import BaseModel
 
 
class ResultadoExame(BaseModel):
    exame: str
    valor: Optional[float]          # número quando inequívoco; senão null
    valor_texto: Optional[str]      # valor original quando não numérico/ambíguo
    unidade: Optional[str]
    referencia: Optional[str]       # intervalo EXATAMENTE como informado pelo laboratório
    classificacao: Literal["abaixo", "dentro_da_referencia", "acima", "ambiguo"]
 
 
class RelatorioExame(BaseModel):
    resumo: str
    resultados: List[ResultadoExame]
    observacoes: List[str]
    pontos_de_atencao: List[str]
    requer_avaliacao_profissional: bool
 