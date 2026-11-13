# ROTAS BASE DA IA: CONSENTIMENTO (LGPD)
from typing import Any, Dict
from fastapi import APIRouter, Depends
from pydantic import BaseModel
 
from auth import exigir_paciente, obter_usuario_atual
from services import auditoria
from services.consentimento import (
    TEXTO_IA, VERSAO_TEXTO_IA, consentimento_vigente, registrar_consentimento,
)
 
router = APIRouter(tags=["IA e consentimento"])
 
 
class ConsentimentoRequest(BaseModel):
    concedido: bool
 
 
@router.get("/consentimento/ia")
def consultar_consentimento_ia(usuario: Dict[str, Any] = Depends(obter_usuario_atual)):
    return {
        "sucesso": True,
        "versao_texto": VERSAO_TEXTO_IA,
        "texto": TEXTO_IA,
        "concedido": consentimento_vigente(usuario["id"]),
    }
 
 
@router.post("/consentimento/ia")
def registrar_consentimento_ia(
    dados: ConsentimentoRequest,
    usuario: Dict[str, Any] = Depends(exigir_paciente),
):
    registrar_consentimento(usuario["id"], dados.concedido)
    auditoria.registrar(
        usuario["id"],
        "consentimento_ia_concedido" if dados.concedido else "consentimento_ia_revogado",
        "consentimentos",
    )
    return {"sucesso": True, "concedido": dados.concedido, "versao_texto": VERSAO_TEXTO_IA}
 