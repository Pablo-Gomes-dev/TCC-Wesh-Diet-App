// ==============================================================================
// TELA DE RELATÓRIOS E LAUDOS LABORATORIAIS - PACIENTE (WISHDIET)
// ==============================================================================
// Esta tela permite ao paciente:
// 1. Consultar a lista de todos os seus exames e status de laudo clínico.
// 2. Acessar laudos com análise de IA que foram validados e aprovados pelo seu nutricionista.
// 3. Visualizar os biomarcadores, pontos de atenção e orientações alimentares.
// 4. Conferir o PDF original do laboratório a qualquer momento.
// 5. Entender de forma transparente quando um exame está em revisão pelo nutricionista.
// ==============================================================================

import { apiFetch, API_BASE_URL } from "@/services/api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// TIPAGEM DOS BIOMARCADORES E RELATÓRIO ESTRUTURADO
export type Biomarcador = {
  exame: string;
  valor: number | null;
  valor_texto: string | null;
  unidade: string | null;
  referencia: string | null;
  classificacao: "abaixo" | "dentro_da_referencia" | "acima" | "ambiguo";
};

export type RelatorioEstruturado = {
  resumo: string;
  resultados: Biomarcador[];
  observacoes: string[];
  pontos_de_atencao: string[];
  requer_avaliacao_profissional: boolean;
};

export type RelatorioCompleto = {
  id: number;
  exame_id: number;
  paciente_id: number;
  nome_paciente: string;
  nome_arquivo: string;
  conteudo_relatorio: string | null;
  conteudo_json: RelatorioEstruturado | null;
  status_revisao: "pendente" | "aprovado" | "rejeitado";
  revisado_em: string | null;
  modelo: string | null;
  data_geracao: string | null;
  relatorio_anterior_id: number | null;
};

export type ExamePaciente = {
  id: number;
  nome_arquivo: string;
  data_envio: string | null;
  status_processamento: string;
  paciente_id: number;
  nome_paciente: string | null;
  tem_relatorio: boolean;
  relatorio_id?: number | null;
  status_revisao?: "pendente" | "aprovado" | "rejeitado" | null;
  relatorio_data?: string | null;
};

type FiltroTipo = "todos" | "aprovados" | "pendentes";

export default function ConsultaRelatorioPacienteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ exameId?: string }>();

  const [exames, setExames] = useState<ExamePaciente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroTipo>("todos");

  // Estado do Modal de Laudo Detalhado
  const [modalVisivel, setModalVisivel] = useState(false);
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);
  const [relatorioSelecionado, setRelatorioSelecionado] =
    useState<RelatorioCompleto | null>(null);
  const [exameEmVisualizacao, setExameEmVisualizacao] =
    useState<ExamePaciente | null>(null);
  const [baixandoPdf, setBaixandoPdf] = useState(false);

  // 1. CARREGAR A LISTA DE EXAMES DO PACIENTE
  const carregarExames = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCarregando(true);
      try {
        const dados = await apiFetch<{ exames: ExamePaciente[] }>("/exames/meus");
        if (dados?.exames && Array.isArray(dados.exames)) {
          setExames(dados.exames);

          // Se recebeu exameId via parâmetros da rota, abre automaticamente o laudo se aprovado
          if (params?.exameId) {
            const idAlvo = parseInt(params.exameId, 10);
            const alvo = dados.exames.find((e) => e.id === idAlvo);
            if (alvo) {
              if (alvo.status_revisao === "aprovado") {
                abrirRelatorio(alvo);
              } else if (alvo.status_revisao === "pendente") {
                Alert.alert(
                  "Laudo em Revisão",
                  "Este exame já foi processado e aguarda a avaliação e liberação do seu nutricionista."
                );
              }
            }
          }
        }
      } catch (erro: any) {
        console.error("Erro ao carregar exames do paciente:", erro);
        Alert.alert(
          "Falha de Carregamento",
          erro?.message ||
            "Não foi possível carregar seus exames. Verifique sua conexão com a internet."
        );
      } finally {
        setCarregando(false);
        setAtualizando(false);
      }
    },
    [params?.exameId]
  );

  useEffect(() => {
    carregarExames();
  }, [carregarExames]);

  const onRefresh = useCallback(() => {
    setAtualizando(true);
    carregarExames(true);
  }, [carregarExames]);

  // 2. ABRIR E BUSCAR DETALHES DO RELATÓRIO APROVADO
  async function abrirRelatorio(exame: ExamePaciente) {
    if (exame.status_revisao !== "aprovado") {
      Alert.alert(
        "Laudo em Revisão Profissional",
        "O laudo deste exame está em análise pelo seu nutricionista responsável. Assim que for validado e aprovado, ficará disponível aqui."
      );
      return;
    }

    try {
      setCarregandoRelatorio(true);
      setExameEmVisualizacao(exame);
      setModalVisivel(true);

      const dadosRelatorio = await apiFetch<RelatorioCompleto>(
        `/exames/${exame.id}/relatorio`
      );
      setRelatorioSelecionado(dadosRelatorio);
    } catch (erro: any) {
      console.error("Erro ao carregar laudo aprovado:", erro);
      setModalVisivel(false);
      Alert.alert(
        "Acesso Restrito ao Laudo",
        erro?.message ||
          "Não foi possível obter o laudo. O relatório pode ainda não ter sido liberado pelo profissional."
      );
    } finally {
      setCarregandoRelatorio(false);
    }
  }

  // 3. VISUALIZAR PDF ORIGINAL DO LABORATÓRIO
  async function handleVisualizarPdfOriginal(exameId: number) {
    try {
      setBaixandoPdf(true);
      const token = await AsyncStorage.getItem("@wishdiet:token");
      if (!token) {
        Alert.alert(
          "Sessão Expirada",
          "Por favor, faça login novamente para visualizar o exame."
        );
        return;
      }

      const caminhoLocal = `${FileSystem.cacheDirectory}exame_paciente_${exameId}.pdf`;
      const resultado = await FileSystem.downloadAsync(
        `${API_BASE_URL}/exames/${exameId}/pdf`,
        caminhoLocal,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (resultado.status !== 200) {
        Alert.alert(
          "Erro ao Visualizar",
          `O servidor retornou o código HTTP ${resultado.status}.`
        );
        return;
      }

      if (Platform.OS === "android") {
        const contentUri = await FileSystem.getContentUriAsync(resultado.uri);
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          type: "application/pdf",
          flags: 1,
        });
      } else {
        Alert.alert(
          "Documento Baixado",
          "O arquivo foi baixado com sucesso em seu dispositivo."
        );
      }
    } catch (erro: any) {
      console.error("Erro ao abrir PDF original:", erro);
      Alert.alert(
        "Erro ao Abrir PDF",
        "Não foi possível abrir o documento PDF. Verifique se o dispositivo possui um leitor de PDF instalado."
      );
    } finally {
      setBaixandoPdf(false);
    }
  }

  // 4. ESTATÍSTICAS RÁPIDAS
  const metricas = useMemo(() => {
    const total = exames.length;
    const aprovados = exames.filter((e) => e.status_revisao === "aprovado").length;
    const pendentes = exames.filter((e) => e.status_revisao === "pendente").length;
    return { total, aprovados, pendentes };
  }, [exames]);

  // 5. FILTRAGEM E BUSCA
  const examesFiltrados = useMemo(() => {
    return exames.filter((item) => {
      const matchBusca =
        !termoBusca ||
        item.nome_arquivo.toLowerCase().includes(termoBusca.toLowerCase());

      if (!matchBusca) return false;

      if (filtroAtivo === "aprovados") {
        return item.status_revisao === "aprovado";
      }
      if (filtroAtivo === "pendentes") {
        return item.status_revisao === "pendente";
      }
      return true;
    });
  }, [exames, termoBusca, filtroAtivo]);

  // FORMATAÇÃO DE TAG DE BIOMARCADOR
  function renderClassificacaoTag(
    classificacao: "abaixo" | "dentro_da_referencia" | "acima" | "ambiguo"
  ) {
    switch (classificacao) {
      case "dentro_da_referencia":
        return (
          <View style={[styles.badgeBase, styles.badgeNormal]}>
            <Text style={styles.textoBadgeNormal}>✓ Normal</Text>
          </View>
        );
      case "acima":
        return (
          <View style={[styles.badgeBase, styles.badgeElevado]}>
            <Text style={styles.textoBadgeElevado}>▲ Elevado</Text>
          </View>
        );
      case "abaixo":
        return (
          <View style={[styles.badgeBase, styles.badgeBaixo]}>
            <Text style={styles.textoBadgeBaixo}>▼ Baixo</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badgeBase, styles.badgeAvaliar]}>
            <Text style={styles.textoBadgeAvaliar}>• Avaliar</Text>
          </View>
        );
    }
  }

  return (
    <View style={styles.container}>
      {/* CABEÇALHO DA TELA */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitulo}>Meus Laudos & Relatórios</Text>
          <Text style={styles.headerSubtitulo}>
            Exames avaliados e liberados pelo seu nutricionista
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={onRefresh}
            colors={["#10B981"]}
          />
        }
      >
        {/* BANNER INFORMATIVO */}
        <View style={styles.bannerInfo}>
          <MaterialIcons
            name="verified-user"
            size={24}
            color="#059669"
            style={{ marginRight: 10 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitulo}>Segurança e Cuidado Clínico</Text>
            <Text style={styles.bannerTexto}>
              Os laudos passam por leitura de biomarcadores e só são
              disponibilizados para você após a validação do seu nutricionista.
            </Text>
          </View>
        </View>

        {/* MÉTRICAS RÁPIDAS */}
        <View style={styles.metricasRow}>
          <View style={[styles.metricaCard, { borderLeftColor: "#3B82F6" }]}>
            <Text style={styles.metricaValor}>{metricas.total}</Text>
            <Text style={styles.metricaLabel}>Total de Exames</Text>
          </View>
          <View style={[styles.metricaCard, { borderLeftColor: "#10B981" }]}>
            <Text style={[styles.metricaValor, { color: "#10B981" }]}>
              {metricas.aprovados}
            </Text>
            <Text style={styles.metricaLabel}>Laudos Liberados</Text>
          </View>
          <View style={[styles.metricaCard, { borderLeftColor: "#F59E0B" }]}>
            <Text style={[styles.metricaValor, { color: "#D97706" }]}>
              {metricas.pendentes}
            </Text>
            <Text style={styles.metricaLabel}>Em Avaliação</Text>
          </View>
        </View>

        {/* BARRA DE PESQUISA */}
        <View style={styles.buscaContainer}>
          <MaterialIcons
            name="search"
            size={20}
            color="#94A3B8"
            style={styles.buscaIcone}
          />
          <TextInput
            style={styles.buscaInput}
            placeholder="Buscar por nome do exame..."
            placeholderTextColor="#94A3B8"
            value={termoBusca}
            onChangeText={setTermoBusca}
          />
          {termoBusca.length > 0 && (
            <TouchableOpacity onPress={() => setTermoBusca("")}>
              <MaterialIcons name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* FILTROS RÁPIDOS */}
        <View style={styles.filtrosRow}>
          <TouchableOpacity
            style={[
              styles.filtroChip,
              filtroAtivo === "todos" && styles.filtroChipAtivo,
            ]}
            onPress={() => setFiltroAtivo("todos")}
          >
            <Text
              style={[
                styles.filtroTexto,
                filtroAtivo === "todos" && styles.filtroTextoAtivo,
              ]}
            >
              Todos ({exames.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filtroChip,
              filtroAtivo === "aprovados" && styles.filtroChipAtivoVerde,
            ]}
            onPress={() => setFiltroAtivo("aprovados")}
          >
            <Text
              style={[
                styles.filtroTexto,
                filtroAtivo === "aprovados" && styles.filtroTextoAtivoVerde,
              ]}
            >
              ✓ Liberados ({metricas.aprovados})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filtroChip,
              filtroAtivo === "pendentes" && styles.filtroChipAtivoAmarelo,
            ]}
            onPress={() => setFiltroAtivo("pendentes")}
          >
            <Text
              style={[
                styles.filtroTexto,
                filtroAtivo === "pendentes" && styles.filtroTextoAtivoAmarelo,
              ]}
            >
              ⏳ Em Análise ({metricas.pendentes})
            </Text>
          </TouchableOpacity>
        </View>

        {/* LISTAGEM DE EXAMES E LAUDOS */}
        {carregando ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingTexto}>
              Carregando seus exames e laudos...
            </Text>
          </View>
        ) : examesFiltrados.length === 0 ? (
          <View style={styles.vazioContainer}>
            <MaterialIcons name="folder-open" size={54} color="#CBD5E1" />
            <Text style={styles.vazioTitulo}>Nenhum exame encontrado</Text>
            <Text style={styles.vazioSubtitulo}>
              {termoBusca
                ? "Nenhum resultado para os termos pesquisados."
                : "Envie seus exames laboratoriais na aba 'Exames' para que seu nutricionista possa analisá-los."}
            </Text>
          </View>
        ) : (
          examesFiltrados.map((item) => {
            const isAprovado = item.status_revisao === "aprovado";
            const isPendente = item.status_revisao === "pendente";

            return (
              <View key={item.id} style={styles.cardExame}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.iconeArquivoContainer}>
                    <MaterialIcons
                      name="description"
                      size={26}
                      color={isAprovado ? "#059669" : "#64748B"}
                    />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardNomeArquivo} numberOfLines={1}>
                      {item.nome_arquivo}
                    </Text>
                    <Text style={styles.cardDataEnvio}>
                      Enviado em: {item.data_envio || "Data recente"}
                    </Text>
                  </View>

                  {/* BADGE DE STATUS */}
                  {isAprovado && (
                    <View style={styles.badgeAprovado}>
                      <MaterialIcons
                        name="check-circle"
                        size={14}
                        color="#059669"
                      />
                      <Text style={styles.textoBadgeAprovado}>Liberado</Text>
                    </View>
                  )}
                  {isPendente && (
                    <View style={styles.badgePendente}>
                      <MaterialIcons name="schedule" size={14} color="#D97706" />
                      <Text style={styles.textoBadgePendente}>Em Análise</Text>
                    </View>
                  )}
                  {!isAprovado && !isPendente && (
                    <View style={styles.badgeSemLaudo}>
                      <Text style={styles.textoBadgeSemLaudo}>Sem Laudo</Text>
                    </View>
                  )}
                </View>

                {/* INFORMATIVO DE STATUS DO LAUDO */}
                {isAprovado ? (
                  <View style={styles.avisoCardAprovado}>
                    <MaterialIcons name="verified" size={16} color="#059669" />
                    <Text style={styles.textoAvisoAprovado}>
                      Laudo validado pelo nutricionista. Biomarcadores prontos
                      para consulta.
                    </Text>
                  </View>
                ) : isPendente ? (
                  <View style={styles.avisoCardPendente}>
                    <MaterialIcons name="info-outline" size={16} color="#D97706" />
                    <Text style={styles.textoAvisoPendente}>
                      Biomarcadores extraídos. Aguardando conferência e
                      aprovação do seu nutricionista.
                    </Text>
                  </View>
                ) : null}

                {/* BOTÕES DE AÇÃO DO CARD */}
                <View style={styles.cardAcoesRow}>
                  <TouchableOpacity
                    style={styles.botaoPdf}
                    onPress={() => handleVisualizarPdfOriginal(item.id)}
                    disabled={baixandoPdf}
                  >
                    <MaterialIcons
                      name="picture-as-pdf"
                      size={16}
                      color="#475569"
                    />
                    <Text style={styles.textoBotaoPdf}>PDF Original</Text>
                  </TouchableOpacity>

                  {isAprovado && (
                    <TouchableOpacity
                      style={styles.botaoVerLaudo}
                      onPress={() => abrirRelatorio(item)}
                    >
                      <MaterialIcons name="analytics" size={18} color="#FFFFFF" />
                      <Text style={styles.textoBotaoVerLaudo}>
                        Visualizar Laudo
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ===================================================================== */}
      {/* MODAL: VISUALIZAÇÃO COMPLETA DO LAUDO CLÍNICO DO PACIENTE             */}
      {/* ===================================================================== */}
      <Modal
        visible={modalVisivel}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisivel(false)}
      >
        <View style={styles.modalContainer}>
          {/* TOPO DO MODAL */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitulo}>Laudo do Exame</Text>
              <Text style={styles.modalSubtitulo} numberOfLines={1}>
                {exameEmVisualizacao?.nome_arquivo || "Documento Laboratorial"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalBotaoFechar}
              onPress={() => setModalVisivel(false)}
            >
              <MaterialIcons name="close" size={24} color="#334155" />
            </TouchableOpacity>
          </View>

          {carregandoRelatorio ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingTexto}>Carregando laudo aprovado...</Text>
            </View>
          ) : relatorioSelecionado ? (
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* SELO DE APROVAÇÃO PROFISSIONAL */}
              <View style={styles.seloAprovacao}>
                <MaterialIcons name="verified" size={28} color="#059669" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.seloTitulo}>
                    Avaliado e Liberado pelo Nutricionista
                  </Text>
                  <Text style={styles.seloTexto}>
                    {relatorioSelecionado.revisado_em
                      ? `Revisado em ${relatorioSelecionado.revisado_em}`
                      : "Revisado clinicamente pelo profissional responsável."}
                  </Text>
                </View>
              </View>

              {/* SÍNTESE CLÍNICA / RESUMO */}
              <View style={styles.secaoCard}>
                <View style={styles.secaoHeaderRow}>
                  <MaterialIcons name="assignment" size={20} color="#0284C7" />
                  <Text style={styles.secaoTitulo}>Resumo do Exame</Text>
                </View>
                <Text style={styles.secaoCorpo}>
                  {relatorioSelecionado.conteudo_json?.resumo ||
                    relatorioSelecionado.conteudo_relatorio ||
                    "Análise laboratorial processada com sucesso."}
                </Text>
              </View>

              {/* PONTOS DE ATENÇÃO */}
              {relatorioSelecionado.conteudo_json?.pontos_de_atencao &&
                relatorioSelecionado.conteudo_json.pontos_de_atencao.length > 0 && (
                  <View style={[styles.secaoCard, styles.secaoCardAtencao]}>
                    <View style={styles.secaoHeaderRow}>
                      <MaterialIcons name="flag" size={20} color="#D97706" />
                      <Text style={[styles.secaoTitulo, { color: "#92400E" }]}>
                        Pontos de Atenção Nutricional
                      </Text>
                    </View>
                    {relatorioSelecionado.conteudo_json.pontos_de_atencao.map(
                      (ponto, idx) => (
                        <View key={idx} style={styles.pontoRow}>
                          <Text style={styles.pontoBullet}>•</Text>
                          <Text style={styles.pontoTexto}>{ponto}</Text>
                        </View>
                      )
                    )}
                  </View>
                )}

              {/* TABELA DE BIOMARCADORES EXTRAÍDOS */}
              <View style={styles.secaoCard}>
                <View style={styles.secaoHeaderRow}>
                  <MaterialIcons name="science" size={20} color="#7C3AED" />
                  <Text style={styles.secaoTitulo}>Biomarcadores Analisados</Text>
                </View>
                <Text style={styles.tabelaDescricao}>
                  Valores obtidos do laudo com as faixas de referência informadas
                  pelo laboratório:
                </Text>

                {relatorioSelecionado.conteudo_json?.resultados &&
                relatorioSelecionado.conteudo_json.resultados.length > 0 ? (
                  relatorioSelecionado.conteudo_json.resultados.map(
                    (item, idx) => {
                      const valorFormatado =
                        item.valor !== null
                          ? item.valor
                          : item.valor_texto || "—";
                      const unidadeStr = item.unidade ? ` ${item.unidade}` : "";

                      return (
                        <View key={idx} style={styles.biomarcadorItem}>
                          <View style={styles.biomarcadorInfoCol}>
                            <Text style={styles.biomarcadorNome}>
                              {item.exame}
                            </Text>
                            <Text style={styles.biomarcadorRef}>
                              Referência: {item.referencia || "Consultar laudo"}
                            </Text>
                          </View>
                          <View style={styles.biomarcadorValorCol}>
                            <Text style={styles.biomarcadorValor}>
                              {valorFormatado}
                              {unidadeStr}
                            </Text>
                            {renderClassificacaoTag(item.classificacao)}
                          </View>
                        </View>
                      );
                    }
                  )
                ) : (
                  <Text style={styles.textoVazio}>
                    Nenhum biomarcador detalhado disponível.
                  </Text>
                )}
              </View>

              {/* OBSERVAÇÕES E CONDUTAS SUGERIDAS */}
              {relatorioSelecionado.conteudo_json?.observacoes &&
                relatorioSelecionado.conteudo_json.observacoes.length > 0 && (
                  <View style={styles.secaoCard}>
                    <View style={styles.secaoHeaderRow}>
                      <MaterialIcons
                        name="lightbulb"
                        size={20}
                        color="#10B981"
                      />
                      <Text style={styles.secaoTitulo}>
                        Orientações e Observações
                      </Text>
                    </View>
                    {relatorioSelecionado.conteudo_json.observacoes.map(
                      (obs, idx) => (
                        <View key={idx} style={styles.pontoRow}>
                          <Text style={styles.pontoBulletVerde}>✓</Text>
                          <Text style={styles.pontoTexto}>{obs}</Text>
                        </View>
                      )
                    )}
                  </View>
                )}

              {/* NOTA ÉTICA E PRIVACIDADE */}
              <View style={styles.avisoEtico}>
                <MaterialIcons name="security" size={20} color="#64748B" />
                <Text style={styles.avisoEticoTexto}>
                  Privacidade Garantida: A extração laboratorial foi realizada
                  estritamente sobre os parâmetros clínicos, sem armazenamento
                  de CPF, endereço ou dados de cadastro. Este laudo é uma
                  ferramenta de suporte ao seu acompanhamento nutricional.
                </Text>
              </View>

              {/* BOTÃO PARA VISUALIZAR PDF ORIGINAL */}
              {exameEmVisualizacao && (
                <TouchableOpacity
                  style={styles.botaoPdfModal}
                  onPress={() =>
                    handleVisualizarPdfOriginal(exameEmVisualizacao.id)
                  }
                  disabled={baixandoPdf}
                >
                  <MaterialIcons
                    name="picture-as-pdf"
                    size={20}
                    color="#1E293B"
                  />
                  <Text style={styles.textoBotaoPdfModal}>
                    {baixandoPdf
                      ? "Baixando documento..."
                      : "Visualizar PDF Original do Laboratório"}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          ) : (
            <View style={styles.modalLoading}>
              <Text style={styles.loadingTexto}>
                Não foi possível carregar os detalhes do laudo.
              </Text>
            </View>
          )}

          {/* RODAPÉ DO MODAL */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.botaoFecharFooter}
              onPress={() => setModalVisivel(false)}
            >
              <Text style={styles.textoBotaoFecharFooter}>Fechar Laudo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ESTILOS DA TELA E DO MODAL
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 54 : 32,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  botaoVoltar: {
    marginRight: 12,
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitulo: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  headerSubtitulo: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  bannerInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  bannerTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#065F46",
    marginBottom: 2,
  },
  bannerTexto: {
    fontSize: 12,
    color: "#047857",
    lineHeight: 17,
  },
  metricasRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  metricaCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  metricaValor: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
  metricaLabel: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  buscaContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  buscaIcone: {
    marginRight: 8,
  },
  buscaInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
  },
  filtrosRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filtroChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#E2E8F0",
  },
  filtroChipAtivo: {
    backgroundColor: "#0F172A",
  },
  filtroChipAtivoVerde: {
    backgroundColor: "#059669",
  },
  filtroChipAtivoAmarelo: {
    backgroundColor: "#D97706",
  },
  filtroTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  filtroTextoAtivo: {
    color: "#FFFFFF",
  },
  filtroTextoAtivoVerde: {
    color: "#FFFFFF",
  },
  filtroTextoAtivoAmarelo: {
    color: "#FFFFFF",
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingTexto: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
  },
  vazioContainer: {
    paddingVertical: 50,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  vazioTitulo: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475569",
    marginTop: 12,
  },
  vazioSubtitulo: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  cardExame: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconeArquivoContainer: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardNomeArquivo: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  cardDataEnvio: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  badgeAprovado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  textoBadgeAprovado: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  badgePendente: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFBEB",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  textoBadgePendente: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
  },
  badgeSemLaudo: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  textoBadgeSemLaudo: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  avisoCardAprovado: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  textoAvisoAprovado: {
    flex: 1,
    fontSize: 12,
    color: "#166534",
  },
  avisoCardPendente: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  textoAvisoPendente: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
  },
  cardAcoesRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  botaoPdf: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  textoBotaoPdf: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  botaoVerLaudo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#059669",
  },
  textoBotaoVerLaudo: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // ESTILOS DO MODAL
  modalContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitulo: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  modalSubtitulo: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  modalBotaoFechar: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  modalLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  seloAprovacao: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  seloTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#065F46",
  },
  seloTexto: {
    fontSize: 12,
    color: "#047857",
    marginTop: 2,
  },
  secaoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  secaoCardAtencao: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  secaoHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  secaoTitulo: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
  },
  secaoCorpo: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 21,
  },
  pontoRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  pontoBullet: {
    fontSize: 16,
    color: "#D97706",
    marginRight: 6,
    lineHeight: 20,
  },
  pontoBulletVerde: {
    fontSize: 14,
    color: "#059669",
    marginRight: 8,
    fontWeight: "700",
  },
  pontoTexto: {
    flex: 1,
    fontSize: 13,
    color: "#451A03",
    lineHeight: 19,
  },
  tabelaDescricao: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 12,
  },
  biomarcadorItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  biomarcadorInfoCol: {
    flex: 1,
    paddingRight: 10,
  },
  biomarcadorNome: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  biomarcadorRef: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  biomarcadorValorCol: {
    alignItems: "flex-end",
  },
  biomarcadorValor: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  badgeBase: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeNormal: {
    backgroundColor: "#DCFCE7",
  },
  textoBadgeNormal: {
    fontSize: 10,
    fontWeight: "700",
    color: "#15803D",
  },
  badgeElevado: {
    backgroundColor: "#FFEDD5",
  },
  textoBadgeElevado: {
    fontSize: 10,
    fontWeight: "700",
    color: "#C2410C",
  },
  badgeBaixo: {
    backgroundColor: "#FEF9C3",
  },
  textoBadgeBaixo: {
    fontSize: 10,
    fontWeight: "700",
    color: "#A16207",
  },
  badgeAvaliar: {
    backgroundColor: "#F3E8FF",
  },
  textoBadgeAvaliar: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7E22CE",
  },
  textoVazio: {
    fontSize: 13,
    color: "#94A3B8",
    fontStyle: "italic",
    paddingVertical: 10,
  },
  avisoEtico: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F1F5F9",
    padding: 12,
    borderRadius: 10,
    gap: 8,
    marginBottom: 16,
  },
  avisoEticoTexto: {
    flex: 1,
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
  },
  botaoPdfModal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E2E8F0",
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  textoBotaoPdfModal: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
  },
  modalFooter: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  botaoFecharFooter: {
    backgroundColor: "#1E293B",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  textoBotaoFecharFooter: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
