"""Importa uma edição TACO CSV para PostgreSQL após validação estrutural."""
import argparse
import csv
import hashlib
import json
from decimal import Decimal, InvalidOperation
from pathlib import Path

from database import get_db_connection

COLUNAS = [
    ("umidade_g", 2), ("energia_kcal", 3), ("energia_kj", 4),
    ("proteina_g", 5), ("lipidios_g", 6), ("colesterol_mg", 7),
    ("carboidratos_g", 8), ("fibra_g", 9), ("cinzas_g", 10),
    ("calcio_mg", 11), ("magnesio_mg", 12), ("manganes_mg", 14),
    ("fosforo_mg", 15), ("ferro_mg", 16), ("sodio_mg", 17),
    ("potassio_mg", 18), ("cobre_mg", 19), ("zinco_mg", 20),
    ("retinol_mcg", 21), ("vitamina_a_re_mcg", 22),
    ("vitamina_a_rae_mcg", 23), ("tiamina_mg", 24),
    ("riboflavina_mg", 25), ("piridoxina_mg", 26),
    ("niacina_mg", 27), ("vitamina_c_mg", 28),
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as arquivo:
        for bloco in iter(lambda: arquivo.read(1024 * 1024), b""):
            digest.update(bloco)
    return digest.hexdigest()


def numero(valor: str):
    valor = (valor or "").strip()
    if not valor or valor.upper() in {"NA", "TR", "*"}:
        return None
    if valor.startswith(","):
        valor = "0" + valor
    if valor.count(",") > 1:
        partes = valor.split(",")
        valor = "".join(partes[:-1]) + "," + partes[-1]
    try:
        return Decimal(valor.replace(".", "").replace(",", "."))
    except InvalidOperation as erro:
        raise ValueError(f"Valor numérico inválido: {valor!r}") from erro


def ler_csv(caminho: Path):
    registros, categoria = [], None
    with caminho.open("r", encoding="cp1252", newline="") as arquivo:
        for linha, row in enumerate(csv.reader(arquivo, delimiter=";"), start=1):
            if not row:
                continue
            primeiro = row[0].strip()
            if primeiro.isdigit():
                if len(row) < 29 or not row[1].strip():
                    raise ValueError(f"Linha {linha}: alimento sem colunas obrigatórias.")
                codigo = int(primeiro)
                valores = {nome: numero(row[indice]) for nome, indice in COLUNAS}
                brutos = {nome: row[indice].strip() for nome, indice in COLUNAS}
                registros.append({"codigo": codigo, "nome": row[1].strip(), "categoria": categoria, "valores": valores, "brutos": brutos})
            elif primeiro and primeiro not in {"Alimento", "Número do"} and not primeiro.startswith("Número"):
                categoria = primeiro
    codigos = [r["codigo"] for r in registros]
    if len(registros) != 597 or sorted(codigos) != list(range(1, 598)):
        raise ValueError(f"Esperados 597 alimentos numerados de 1 a 597; encontrados {len(registros)}.")
    return registros


def importar(pdf: Path, csv_path: Path, edicao: str, ano: int):
    registros = ler_csv(csv_path)
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""INSERT INTO taco_importacoes
                (edicao, ano, arquivo_pdf, arquivo_csv, hash_pdf, hash_csv, total_registros)
                VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                (edicao, ano, pdf.name, csv_path.name, sha256(pdf), sha256(csv_path), len(registros)))
            importacao_id = cur.fetchone()[0]
            for registro in registros:
                cur.execute("""INSERT INTO taco_alimentos
                    (importacao_id,codigo_taco,nome,categoria,valores_originais)
                    VALUES (%s,%s,%s,%s,%s::jsonb) RETURNING id""",
                    (importacao_id, registro["codigo"], registro["nome"], registro["categoria"], json.dumps(registro["brutos"], ensure_ascii=False)))
                alimento_id = cur.fetchone()[0]
                campos = list(registro["valores"])
                cur.execute(f"INSERT INTO taco_composicao (alimento_id,{','.join(campos)}) VALUES (%s,{','.join(['%s'] * len(campos))})", [alimento_id] + [registro["valores"][campo] for campo in campos])
            conn.commit()
    return importacao_id


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--csv", dest="csv_path", type=Path, required=True)
    parser.add_argument("--edicao", default="4ª edição revisada e ampliada")
    parser.add_argument("--ano", type=int, default=2011)
    args = parser.parse_args()
    if not args.pdf.is_file() or not args.csv_path.is_file():
        raise SystemExit("PDF e CSV precisam existir.")
    print(f"Importação criada: {importar(args.pdf, args.csv_path, args.edicao, args.ano)}")
