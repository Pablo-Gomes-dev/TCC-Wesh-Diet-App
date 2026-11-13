# TESTES UNITÁRIOS DO SERVIÇO DE IA (SEM REDE E SEM BANCO: TUDO É SIMULADO)
from types import SimpleNamespace
 
import httpx
import openai
import pytest
 
from schemas.checkin_schema import AnaliseCheckin
from schemas.exame_schema import RelatorioExame
from schemas.plano_schema import PlanoAlimentar
from services import openai_service as svc
from services.openai_service import Funcionalidade, IAIndisponivelError
 
 
class FakeClient:
    def __init__(self, resposta=None, erro=None):
        self.responses = SimpleNamespace(parse=self._parse)
        self._resposta, self._erro, self.chamadas = resposta, erro, []
 
    def _parse(self, **kwargs):
        self.chamadas.append(kwargs)
        if self._erro:
            raise self._erro
        return self._resposta
 
 
@pytest.fixture
def usos(monkeypatch):
    registros = []
    monkeypatch.setattr(svc, "_registrar_uso", lambda **kw: registros.append(kw))
    return registros
 
 
def _checkin():
    return AnaliseCheckin(classificacao="evolucao", resumo="ok", pontos_positivos=[],
                          pontos_de_atencao=[], observacoes=[], requer_avaliacao_profissional=True)
 
 
def test_custo_estimado_usa_precos_por_milhao(monkeypatch):
    monkeypatch.delenv("OPENAI_PRECO_ENTRADA_CHECKIN", raising=False)
    monkeypatch.delenv("OPENAI_PRECO_SAIDA_CHECKIN", raising=False)
    # Luna: US$0,10 entrada / US$0,50 saída por 1M
    assert svc.estimar_custo_usd(Funcionalidade.CHECKIN, 1_000_000, 1_000_000) == 0.60
 
 
def test_modelo_configuravel_por_env(monkeypatch):
    monkeypatch.setenv("OPENAI_MODEL_EXAME", "modelo-x")
    assert svc.modelo_da_funcionalidade(Funcionalidade.EXAME) == "modelo-x"
 
 
def test_sem_chave_levanta_erro_seguro_e_registra(monkeypatch, usos):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setattr(svc, "_cliente", None)
    with pytest.raises(IAIndisponivelError) as exc:
        svc.gerar_estruturado(funcionalidade=Funcionalidade.CHECKIN, instrucoes="i",
                              dados={}, schema=AnaliseCheckin)
    assert exc.value.codigo == "nao_configurado"
    assert usos[0]["resultado"] == "erro"
 
 
def test_sucesso_envia_store_false_e_registra_tokens(monkeypatch, usos):
    resposta = SimpleNamespace(output_parsed=_checkin(),
                               usage=SimpleNamespace(input_tokens=100, output_tokens=50))
    fake = FakeClient(resposta)
    monkeypatch.setattr(svc, "_obter_cliente", lambda: fake)
 
    r = svc.gerar_estruturado(funcionalidade=Funcionalidade.CHECKIN, instrucoes="i",
                              dados={"peso": 80}, schema=AnaliseCheckin, usuario_id=1, paciente_id=2)
 
    chamada = fake.chamadas[0]
    assert chamada["store"] is False
    assert chamada["text_format"] is AnaliseCheckin
    assert chamada["max_output_tokens"] == svc.CONFIG[Funcionalidade.CHECKIN].max_saida
    assert r.tokens_entrada == 100 and r.tokens_saida == 50
    assert usos[0]["resultado"] == "sucesso" and usos[0]["paciente_id"] == 2
 
 
def test_resposta_sem_parse_vira_resposta_invalida(monkeypatch, usos):
    resposta = SimpleNamespace(output_parsed=None,
                               usage=SimpleNamespace(input_tokens=10, output_tokens=5))
    monkeypatch.setattr(svc, "_obter_cliente", lambda: FakeClient(resposta))
    with pytest.raises(IAIndisponivelError) as exc:
        svc.gerar_estruturado(funcionalidade=Funcionalidade.EXAME, instrucoes="i",
                              dados={}, schema=RelatorioExame)
    assert exc.value.codigo == "resposta_invalida"
 
 
def test_erro_de_conexao_nao_vaza_detalhes(monkeypatch, usos):
    erro = openai.APIConnectionError(request=httpx.Request("POST", "https://x.test"))
    monkeypatch.setattr(svc, "_obter_cliente", lambda: FakeClient(erro=erro))
    with pytest.raises(IAIndisponivelError) as exc:
        svc.gerar_estruturado(funcionalidade=Funcionalidade.PLANO, instrucoes="i",
                              dados={}, schema=PlanoAlimentar)
    assert exc.value.codigo == "indisponivel"
    assert "x.test" not in str(exc.value)
    assert usos[0]["tipo_erro"] == "indisponivel"
 
 
def test_schema_aceita_exemplo_de_relatorio():
    rel = RelatorioExame.model_validate({
        "resumo": "Resumo", "observacoes": [], "pontos_de_atencao": [],
        "requer_avaliacao_profissional": True,
        "resultados": [{"exame": "Hemoglobina", "valor": 13.5, "valor_texto": None, "unidade": "g/dL",
                        "referencia": "12.0 - 16.0", "classificacao": "dentro_da_referencia"}],
    })
    assert rel.resultados[0].valor == 13.5
 