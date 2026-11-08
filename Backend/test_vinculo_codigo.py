import time
import pytest
from fastapi.testclient import TestClient
from main import app

cliente = TestClient(app)
TS = int(time.time())

def test_fluxo_codigo_vinculo_e_regra_de_ouro():
    # 1. Cadastra Nutricionista
    email_nutri = f"nutri_vinculo_{TS}@teste.com"
    resp_nutri = cliente.post("/auth/cadastro", json={
        "nome": "Dra. Renata Nutri",
        "email": email_nutri,
        "senha": "SenhaForte123@",
        "tipo_usuario": "nutricionista",
        "crn": f"CRN-SP-{TS}"
    })
    assert resp_nutri.status_code == 201
    assert resp_nutri.json()["usuario"]["status_aprovacao"] == "pendente"

    # Simula aprovação profissional pelo administrador no banco de dados
    from database import get_db_connection
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE usuarios SET status_aprovacao = 'aprovado' WHERE email = %s;", (email_nutri,))

    token_nutri = resp_nutri.json()["token"]
    headers_nutri = {"Authorization": f"Bearer {token_nutri}"}

    # 2. Nutricionista consulta seu código único de vínculo
    resp_cod = cliente.get("/nutricionista/meu-codigo-vinculo", headers=headers_nutri)
    assert resp_cod.status_code == 200
    codigo_vinculo = resp_cod.json()["codigo_vinculo"]
    assert codigo_vinculo.startswith("NUTRI-")

    # 3. Cadastra Paciente
    email_paciente = f"paciente_vinculo_{TS}@teste.com"
    resp_paciente = cliente.post("/auth/cadastro", json={
        "nome": "Lucas Paciente",
        "email": email_paciente,
        "senha": "SenhaForte123@",
        "tipo_usuario": "paciente"
    })
    assert resp_paciente.status_code == 201
    token_paciente = resp_paciente.json()["token"]
    headers_paciente = {"Authorization": f"Bearer {token_paciente}"}

    # 4. Antes de vincular, paciente não tem nutricionista
    resp_meu_nutri_antes = cliente.get("/paciente/meu-nutricionista", headers=headers_paciente)
    assert resp_meu_nutri_antes.status_code == 200
    assert resp_meu_nutri_antes.json()["vinculado"] is False

    # 5. Nutricionista não vê nenhum paciente na sua lista ainda
    resp_lista_antes = cliente.get("/nutricionista/meus-pacientes", headers=headers_nutri)
    assert resp_lista_antes.status_code == 200
    assert resp_lista_antes.json()["total"] == 0

    # 6. Paciente tenta vincular com código inexistente (deve falhar 404)
    resp_cod_invalido = cliente.post("/paciente/vincular-por-codigo", json={"codigo": "CODIGO_FALSO"}, headers=headers_paciente)
    assert resp_cod_invalido.status_code == 404

    # 7. Paciente se vincula usando o código correto do nutricionista
    resp_vinculo = cliente.post("/paciente/vincular-por-codigo", json={"codigo": codigo_vinculo}, headers=headers_paciente)
    assert resp_vinculo.status_code == 201
    assert "Dra. Renata Nutri" in resp_vinculo.json()["mensagem"]

    # 8. Paciente tenta vincular novamente com o mesmo código (deve rejeitar 400)
    resp_vinculo_duplicado = cliente.post("/paciente/vincular-por-codigo", json={"codigo": codigo_vinculo}, headers=headers_paciente)
    assert resp_vinculo_duplicado.status_code == 400

    # 9. Agora paciente consulta seu nutricionista (deve estar vinculado)
    resp_meu_nutri_depois = cliente.get("/paciente/meu-nutricionista", headers=headers_paciente)
    assert resp_meu_nutri_depois.status_code == 200
    assert resp_meu_nutri_depois.json()["vinculado"] is True
    assert resp_meu_nutri_depois.json()["nutricionista"]["nome"] == "Dra. Renata Nutri"

    # 10. Nutricionista agora vê o paciente na lista de seus pacientes
    resp_lista_depois = cliente.get("/nutricionista/meus-pacientes", headers=headers_nutri)
    assert resp_lista_depois.status_code == 200
    assert resp_lista_depois.json()["total"] == 1
    paciente_vinculado = resp_lista_depois.json()["pacientes"][0]
    assert paciente_vinculado["nome"] == "Lucas Paciente"
    paciente_id = paciente_vinculado["id"]

    # 11. REGRA DE OURO: Nutricionista vinculado consegue analisar o paciente
    resp_analise_permitida = cliente.post("/analise", json={
        "paciente_id": paciente_id,
        "nome": "Lucas Paciente",
        "idade": "28",
        "peso": "75",
        "altura": "175",
        "objetivo": "Hipertrofia"
    }, headers=headers_nutri)
    assert resp_analise_permitida.status_code == 200

    # 12. REGRA DE OURO: Outro nutricionista SEM vínculo tenta acessar/analisar este paciente (deve ser bloqueado 403)
    email_outro_nutri = f"outro_nutri_{TS}@teste.com"
    resp_outro_nutri = cliente.post("/auth/cadastro", json={
        "nome": "Dr. Estranho Nutri",
        "email": email_outro_nutri,
        "senha": "SenhaForte123@",
        "tipo_usuario": "nutricionista",
        "crn": f"CRN-RJ-{TS}"
    })
    token_outro_nutri = resp_outro_nutri.json()["token"]
    headers_outro_nutri = {"Authorization": f"Bearer {token_outro_nutri}"}

    resp_analise_bloqueada = cliente.post("/analise", json={
        "paciente_id": paciente_id,
        "nome": "Lucas Paciente",
        "idade": "28",
        "peso": "75",
        "altura": "175",
        "objetivo": "Hipertrofia"
    }, headers=headers_outro_nutri)
    assert resp_analise_bloqueada.status_code == 403

    # 13. Desvinculação pelo Nutricionista
    resp_desvincular = cliente.patch(f"/nutricionista/desvincular-paciente/{paciente_id}", headers=headers_nutri)
    assert resp_desvincular.status_code == 200

    # 14. Após desvincular, a lista do Nutricionista fica vazia novamente
    resp_lista_fim = cliente.get("/nutricionista/meus-pacientes", headers=headers_nutri)
    assert resp_lista_fim.json()["total"] == 0
