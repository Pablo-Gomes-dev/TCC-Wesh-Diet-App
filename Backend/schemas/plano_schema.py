from typing import List, Optional
from pydantic import BaseModel


class ItemAlimento(BaseModel):
    alimento: str
    quantidade: float
    unidade: str
    observacao: Optional[str] = None


class Substituicao(BaseModel):
    alimento_original: str
    alimento_substituto: str
    quantidade_substituto: float
    unidade_substituto: str
    justificativa: str
    equivalencia_nutricional: str


class Refeicao(BaseModel):
    nome: str
    horario_sugerido: Optional[str] = None
    itens: List[ItemAlimento]
    substituicoes: List[Substituicao]


class PlanoAlimentar(BaseModel):
    objetivo_nutricional: str
    refeicoes: List[Refeicao]
    observacoes: List[str]
    restricoes_consideradas: List[str]
    requer_revisao_profissional: bool
