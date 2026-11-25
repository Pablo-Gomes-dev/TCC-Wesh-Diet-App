import pytest
import io
from pathlib import Path
from extrator_pdf import extrair_texto_pdf, filtrar_apenas_biomarcadores

TERMOS_PROIBIDOS = [
    "cpf",
    "recebimento",
    "data da geração",
    "data de geração",
    "nucleo de assessoria medica",
    "assessoria médica",
    "nam - núcleo",
    "fap:",
    "médico solicitante",
    "medico solicitante",
    "crm",
    "hash:",
    "cnse",
    "cnes",
    "valida.dasa.com.br",
    "token:",
]


def test_extracao_bloqueia_dados_pessoais_e_administrativos():
    """Valida que o extrator de PDF elimina completamente todos os termos restritos pelo usuário."""
    pdf_path = Path(__file__).parent / "storage_privado" / "exames" / "c57a81a9-f4f3-4eca-98bb-9e4762aa2218.pdf"
    if not pdf_path.exists():
        pytest.skip("PDF de teste não encontrado no storage")

    res = extrair_texto_pdf(pdf_path.read_bytes(), "exame_completo.pdf", apenas_biomarcadores=True)
    assert res["sucesso"] is True
    texto = res["texto_extraido"]

    # Deve conter biomarcadores úteis
    assert "Hemoglobina" in texto
    assert "Hematócrito" in texto
    assert "Contagem de Plaquetas" in texto

    # Não deve conter termos restritos
    texto_lower = texto.lower()
    for termo in TERMOS_PROIBIDOS:
        assert termo not in texto_lower, f"Termo proibido encontrado no texto extraído: '{termo}'"

    # Não deve conter CPF nem Hashes
    import re
    assert re.search(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", texto) is None
    assert re.search(r"\b[a-fA-F0-9]{32,64}\b", texto) is None
    assert re.search(r"\b480\.172\b", texto) is None
    assert "Gabriel Monteiro Roma" not in texto


def test_filtro_biomarcadores_em_texto_sintetico():
    """Valida o filtro em texto arbitrário com dados pessoais injetados."""
    texto_sujo = (
        "Laboratório Central - Rua das Amoras 45\n"
        "Paciente: Maria de Souza | CPF: 123.456.789-00 | DN: 01/01/1990\n"
        "Médico: Dr. Roberto Alencar - CRM/SP 998877\n"
        "FAP: 1122334455 | DATA COLETA/RECEBIMENTO: 10/10/2026 08:00\n"
        "Data da geração: 11/10/2026\n"
        "NAM - Núcleo de Assessoria Médica: 4020-0000\n"
        "Glicose em Jejum: 88 mg/dL (VR: 70 a 99 mg/dL)\n"
        "Colesterol Total: 175 mg/dL (VR: inferior a 190 mg/dL)\n"
        "Triglicérides: 110 mg/dL (VR: inferior a 150 mg/dL)\n"
        "Hash: a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef\n"
        "CNES: 1234567\n"
    )

    texto_limpo = filtrar_apenas_biomarcadores(texto_sujo)

    # Biomarcadores preservados
    assert "Glicose" in texto_limpo
    assert "88 mg/dL" in texto_limpo
    assert "Colesterol Total" in texto_limpo
    assert "Triglicérides" in texto_limpo

    # Dados proibidos expurgados
    for termo in ["123.456.789-00", "Maria de Souza", "Roberto Alencar", "CRM", "FAP", "RECEBIMENTO", "geração", "NAM", "Hash", "CNES"]:
        assert termo.lower() not in texto_limpo.lower()
