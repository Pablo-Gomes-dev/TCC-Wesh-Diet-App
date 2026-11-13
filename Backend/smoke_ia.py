# TESTE DE FUMAÇA DA OPENAI (FAZ UMA CHAMADA REAL E BARATA; USA A CHAVE DO .env)
# Uso: cd Backend && python smoke_ia.py
# Valida: chave, nome do modelo de check-in, Responses API (responses.parse) e schema.
from dotenv import load_dotenv
 
load_dotenv()
 
from schemas.checkin_schema import AnaliseCheckin
from services.openai_service import Funcionalidade, IAIndisponivelError, gerar_estruturado, modelo_da_funcionalidade
from services.prompts import INSTRUCOES_CHECKIN
 
dados = {
    "objetivo": "Emagrecimento",
    "diferencas": {"peso_kg": -0.8, "cintura_cm": -1.0, "adesao_percentual": 10},
    "dificuldades": "Fim de semana difícil",
}
 
print("Modelo:", modelo_da_funcionalidade(Funcionalidade.CHECKIN))
try:
    r = gerar_estruturado(
        funcionalidade=Funcionalidade.CHECKIN, instrucoes=INSTRUCOES_CHECKIN,
        dados=dados, schema=AnaliseCheckin,
    )
except IAIndisponivelError as e:
    raise SystemExit(f"FALHOU [{e.codigo}]: {e.mensagem}")
 
print("Classificação:", r.dados.classificacao)
print("Resumo:", r.dados.resumo)
print(f"Tokens: {r.tokens_entrada} entrada / {r.tokens_saida} saída | custo ~US$ {r.custo_estimado_usd}")
 