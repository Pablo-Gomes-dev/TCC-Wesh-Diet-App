from pathlib import Path

import pytest

from scripts.importar_taco import ler_csv, numero


CSV_ORIGINAL = Path(r"C:\Users\User\Downloads\Taco-4a-Edicao(CMVCol taco3).csv")


def test_numero_preserva_ausentes_e_tracos():
    assert numero("NA") is None
    assert numero("Tr") is None
    assert numero("124") == 124
    assert str(numero("2,6")) == "2.6"


@pytest.mark.skipif(not CSV_ORIGINAL.exists(), reason="CSV TACO local não disponível")
def test_csv_taco_contem_597_alimentos_numerados():
    registros = ler_csv(CSV_ORIGINAL)
    assert len(registros) == 597
    assert registros[0]["codigo"] == 1
    assert registros[-1]["codigo"] == 597
    assert all(registro["nome"] for registro in registros)
    assert all("energia_kcal" in registro["valores"] for registro in registros)
