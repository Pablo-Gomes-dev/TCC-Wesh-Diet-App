# SCHEMA DE RESPOSTA ESTRUTURADA - ANÁLISE DE CHECK-IN (GPT-6 Luna)
# As diferenças numéricas NÃO fazem parte da resposta da IA: o Python as calcula
# e as armazena em analises_checkins.diferencas.
from typing import List, Literal
from pydantic import BaseModel
 
 
class AnaliseCheckin(BaseModel):
    classificacao: Literal["evolucao", "estabilidade", "involucao"]
    resumo: str
    pontos_positivos: List[str]
    pontos_de_atencao: List[str]
    observacoes: List[str]
    requer_avaliacao_profissional: bool
 