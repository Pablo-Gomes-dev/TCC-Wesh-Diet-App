# SCHEMA DE RESPOSTA ESTRUTURADA - PLANO ALIMENTAR (GPT-6.1 Terra)
from typing import List, Optional
from pydantic import BaseModel
 
 
class ItemAlimento(BaseModel):
    alimento: str
    quantidade: float
    unidade: str                    # g, ml, unidade, colher_sopa, etc.
    observacao: Optional[str]
 
 
class Refeicao(BaseModel):
    nome: str                       # ex.: "Café da manhã"
    horario_sugerido: Optional[str]
    itens: List[ItemAlimento]
    substituicoes: List[str]        # opções de troca (ex.: "pão integral ↔ tapioca")
 
 
class PlanoAlimentar(BaseModel):
    objetivo_nutricional: str
    refeicoes: List[Refeicao]
    observacoes: List[str]
    restricoes_consideradas: List[str]
    requer_revisao_profissional: bool
 