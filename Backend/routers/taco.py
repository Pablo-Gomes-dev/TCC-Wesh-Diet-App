from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth import exigir_admin, exigir_nutricionista
from database import get_db_connection

router = APIRouter(tags=["taco"])


def catalogo_aprovado(cur, limite: int = 597):
    cur.execute("""SELECT a.codigo_taco,a.nome,a.categoria FROM taco_alimentos a
                   JOIN taco_importacoes i ON i.id=a.importacao_id
                   WHERE i.status='aprovada' ORDER BY a.codigo_taco LIMIT %s""", (limite,))
    return [{"codigo_taco": r[0], "nome": r[1], "categoria": r[2]} for r in cur.fetchall()]


class StatusTacoRequest(BaseModel):
    status: str = Field(..., pattern="^(aprovada|inativa|rejeitada)$")


@router.get("/admin/taco/importacoes")
def listar_importacoes_taco(usuario: dict = Depends(exigir_admin)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""SELECT id,fonte,instituicao,edicao,ano,arquivo_pdf,arquivo_csv,
                                  total_registros,status,importado_em,aprovado_em
                           FROM taco_importacoes ORDER BY importado_em DESC,id DESC""")
            linhas = cur.fetchall()
    return {"importacoes": [{"id":r[0],"fonte":r[1],"instituicao":r[2],"edicao":r[3],"ano":r[4],"arquivo_pdf":r[5],"arquivo_csv":r[6],"total_registros":r[7],"status":r[8],"importado_em":r[9].isoformat() if r[9] else None,"aprovado_em":r[10].isoformat() if r[10] else None} for r in linhas]}


@router.patch("/admin/taco/importacoes/{importacao_id}/status")
def alterar_status_taco(importacao_id: int, dados: StatusTacoRequest, usuario: dict = Depends(exigir_admin)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if dados.status == "aprovada":
                cur.execute("UPDATE taco_importacoes SET status='inativa' WHERE fonte='TACO' AND status='aprovada' AND id<>%s", (importacao_id,))
                cur.execute("""UPDATE taco_importacoes SET status='aprovada',aprovado_por=%s,aprovado_em=NOW()
                               WHERE id=%s AND status='pendente' RETURNING id""", (usuario["id"], importacao_id))
            else:
                cur.execute("UPDATE taco_importacoes SET status=%s WHERE id=%s AND status='pendente' RETURNING id", (dados.status, importacao_id))
            linha = cur.fetchone(); conn.commit()
    if not linha:
        raise HTTPException(status_code=404, detail="Importação TACO pendente não encontrada.")
    return {"sucesso": True, "id": importacao_id, "status": dados.status}


@router.get("/nutricionista/taco/alimentos")
def buscar_alimentos_taco(q: Optional[str] = Query(None, min_length=2, max_length=120), limite: int = Query(20, ge=1, le=100), usuario: dict = Depends(exigir_nutricionista)):
    termo = (q or "").strip()
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""SELECT a.codigo_taco,a.nome,a.categoria,c.energia_kcal,c.proteina_g,c.carboidratos_g,c.lipidios_g,c.fibra_g
                           FROM taco_alimentos a JOIN taco_importacoes i ON i.id=a.importacao_id
                           JOIN taco_composicao c ON c.alimento_id=a.id
                           WHERE i.status='aprovada' AND (%s='' OR a.nome ILIKE %s)
                           ORDER BY a.nome LIMIT %s""", (termo, f"%{termo}%", limite))
            linhas = cur.fetchall()
    return {"alimentos": [{"codigo_taco":r[0],"nome":r[1],"categoria":r[2],"energia_kcal":float(r[3]) if r[3] is not None else None,"proteina_g":float(r[4]) if r[4] is not None else None,"carboidratos_g":float(r[5]) if r[5] is not None else None,"lipidios_g":float(r[6]) if r[6] is not None else None,"fibra_g":float(r[7]) if r[7] is not None else None} for r in linhas]}
