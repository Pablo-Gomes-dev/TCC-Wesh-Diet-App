// ==============================================================================
// TELA DE RELATÓRIOS CLÍNICOS E AVALIAÇÃO DE IA - NUTRICIONISTA (WISHDIET)
// ==============================================================================
// Esta tela permite ao nutricionista:
// 1. Visualizar todos os exames dos seus pacientes vinculados.
// 2. Disparar a extração e análise por Inteligência Artificial dos PDFs de exames.
// 3. Avaliar criticamente os biomarcadores e pontos de atenção extraídos pela IA.
// 4. Aprovar o laudo (disponibilizando-o na tela do paciente) ou rejeitá-lo.
// 5. Visualizar o documento PDF original para conferência médica/laboratorial.
// ==============================================================================

import { apiFetch, API_BASE_URL } from "@/services/api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { router } from "expo-router";
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

// TIPAGEM DOS BIOMARCADORES E RELATÓRIO ESTRUTURADO DA IA
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

export type RelatorioItem = {
  id: number;
  status_revisao: "pendente" | "aprovado" | "rejeitado";
  data_geracao: string | null;
  revisado_em: string | null;
  modelo: string | null;
  conteudo_json: RelatorioEstruturado | null;
  conteudo_relatorio: string | null;
};

export type ExameComRelatorio = {
  exame_id: number;
  nome_arquivo: string;
  data_envio: string | null;
  status_processamento: string;
  paciente_id: number;
  nome_paciente: string;
  tem_relatorio: boolean;
  relatorio: RelatorioItem | null;
};

type FiltroTipo = "todos" | "pendentes" | "aprovados" | "sem_relatorio";

export default function RelatorioNutricionistaScreen() {
  const [itens, setItens] = useState<ExameComRelatorio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroTipo>("todos");

  // Estado para operação de geração de IA em andamento
  const [gerandoExameId, setGerandoExameId] = useState<number | null>(null);

  // Estado para o modal de visualização e avaliação do relatório
  const [exameSelecionado, setExameSelecionado] = useState<ExameComRelatorio | null>(null);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [processandoRevisao, setProcessandoRevisao] = useState(false);

  // CARREGAR LISTA DE RELATÓRIOS DO NUTRICIONISTA
  const carregarRelatorios = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const resposta = await apiFetch<{ sucesso: boolean; total: number; itens: ExameComRelatorio[] }>(
        "/relatorios/nutricionista"
      );
      if (resposta?.itens) {
        setItens(resposta.itens);
      }
    } catch (erro: any) {
      console.error("Erro ao carregar relatórios:", erro);
      Alert.alert(
        "Erro de Carregamento",
        erro?.message || "Não foi possível carregar a lista de relatórios. Verifique sua conexão com o servidor."
      );
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    carregarRelatorios();
  }, [carregarRelatorios]);

  const onRefresh = useCallback(() => {
    setAtualizando(true);
    carregarRelatorios(true);
  }, [carregarRelatorios]);

  // GERAR RELATÓRIO COM INTELIGÊNCIA ARTIFICIAL
  async function handleGerarRelatorio(exameId: number, forcarNovo = false) {
    try {
      setGerandoExameId(exameId);
      const resposta = await apiFetch<{
        sucesso: boolean;
        mensagem: string;
        relatorio: {
          id: number;
          exame_id: number;
          paciente_id: number;
          nome_paciente: string;
          nome_arquivo: string;
          status_revisao: "pendente" | "aprovado" | "rejeitado";
          data_geracao: string | null;
          modelo: string | null;
          conteudo_relatorio: string | null;
          conteudo_json: RelatorioEstruturado | null;
        };
      }>("/relatorios/gerar", {
        method: "POST",
        body: { exame_id: exameId, forcar_novo: forcarNovo },
      });

      if (resposta.sucesso && resposta.relatorio) {
        // Atualiza a lista local com o novo relatório
        await carregarRelatorios(true);

        // Abre diretamente o modal para avaliação do nutricionista
        const itemAtualizado: ExameComRelatorio = {
          exame_id: resposta.relatorio.exame_id,
          nome_arquivo: resposta.relatorio.nome_arquivo,
          data_envio: null,
          status_processamento: "concluido",
          paciente_id: resposta.relatorio.paciente_id,
          nome_paciente: resposta.relatorio.nome_paciente,
          tem_relatorio: true,
          relatorio: {
            id: resposta.relatorio.id,
            status_revisao: resposta.relatorio.status_revisao,
            data_geracao: resposta.relatorio.data_geracao,
            revisado_em: null,
            modelo: resposta.relatorio.modelo,
            conteudo_json: resposta.relatorio.conteudo_json,
            conteudo_relatorio: resposta.relatorio.conteudo_relatorio,
          },
        };
        setExameSelecionado(itemAtualizado);
        setModalVisivel(true);

        Alert.alert(
          "Análise Concluída!",
          "A IA analisou os dados extraídos do exame. Avalie os biomarcadores e aprove para liberar o laudo ao paciente."
        );
      }
    } catch (erro: any) {
      console.error("Erro ao gerar relatório com IA:", erro);
      Alert.alert(
        "Falha na Análise por IA",
        erro?.message || "Não foi possível gerar a análise do exame. Verifique se o arquivo possui texto legível."
      );
    } finally {
      setGerandoExameId(null);
    }
  }

  // APROVAR OU REJEITAR O RELATÓRIO
  async function handleRevisarRelatorio(statusRevisao: "aprovado" | "rejeitado") {
    if (!exameSelecionado?.relatorio?.id) return;

    const relatorioId = exameSelecionado.relatorio.id;
    const nomePaciente = exameSelecionado.nome_paciente;

    const mensagemConfirmacao =
      statusRevisao === "aprovado"
        ? `Tem certeza que deseja APROVAR este laudo?\n\nEle será disponibilizado imediatamente na tela de relatórios de ${nomePaciente}.`
        : `Deseja rejeitar este laudo?\n\nEle não ficará disponível para o paciente.`;

    Alert.alert(
      statusRevisao === "aprovado" ? "Confirmar Aprovação" : "Confirmar Rejeição",
      mensagemConfirmacao,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: statusRevisao === "aprovado" ? "Aprovar e Liberar" : "Rejeitar",
          style: statusRevisao === "aprovado" ? "default" : "destructive",
          onPress: async () => {
            setProcessandoRevisao(true);
            try {
              const resposta = await apiFetch<{
                sucesso: boolean;
                mensagem: string;
                relatorio_id: number;
                status_revisao: "aprovado" | "rejeitado";
                revisado_em: string | null;
              }>(`/relatorios/${relatorioId}/revisao`, {
                method: "PATCH",
                body: { status_revisao: statusRevisao },
              });

              if (resposta.sucesso) {
                // Atualiza o exame no modal
                setExameSelecionado((prev) => {
                  if (!prev || !prev.relatorio) return prev;
                  return {
                    ...prev,
                    relatorio: {
                      ...prev.relatorio,
                      status_revisao: statusRevisao,
                      revisado_em: resposta.revisado_em,
                    },
                  };
                });

                // Atualiza a lista principal em segundo plano
                await carregarRelatorios(true);

                Alert.alert(
                  statusRevisao === "aprovado" ? "Laudo Aprovado! 🎉" : "Laudo Rejeitado",
                  resposta.mensagem
                );
              }
            } catch (erro: any) {
              console.error("Erro ao revisar relatório:", erro);
              Alert.alert("Erro ao salvar revisão", erro?.message || "Não foi possível registrar sua decisão.");
            } finally {
              setProcessandoRevisao(false);
            }
          },
        },
      ]
    );
  }

  // VISUALIZAR O PDF ORIGINAL DO EXAME
  async function handleVisualizarPDF(exameId: number) {
    try {
      const token = await AsyncStorage.getItem("@wishdiet:token");
      if (!token) {
        Alert.alert("Sessão expirada", "Faça login novamente para visualizar o exame.");
        return;
      }

      const caminhoLocal = `${FileSystem.cacheDirectory}exame_${exameId}.pdf`;
      const resultado = await FileSystem.downloadAsync(`${API_BASE_URL}/exames/${exameId}/pdf`, caminhoLocal, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resultado.status !== 200) {
        Alert.alert("Erro", `Não foi possível carregar o arquivo PDF (HTTP ${resultado.status}).`);
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
        Alert.alert("Sucesso", "Documento PDF pronto para visualização.");
      }
    } catch (erro) {
      console.error("Erro ao abrir PDF:", erro);
      Alert.alert("Erro ao abrir PDF", "Certifique-se de que há um leitor de PDF instalado.");
    }
  }

  // FILTRAGEM E BUSCA DINÂMICA
  const itensFiltrados = useMemo(() => {
    return itens.filter((item) => {
      // Filtro por texto
      const correspondeBusca =
        termoBusca.trim() === "" ||
        item.nome_paciente.toLowerCase().includes(termoBusca.toLowerCase()) ||
        item.nome_arquivo.toLowerCase().includes(termoBusca.toLowerCase());

      if (!correspondeBusca) return false;

      // Filtro por status
      if (filtroAtivo === "pendentes") {
        return item.tem_relatorio && item.relatorio?.status_revisao === "pendente";
      }
      if (filtroAtivo === "aprovados") {
        return item.tem_relatorio && item.relatorio?.status_revisao === "aprovado";
      }
      if (filtroAtivo === "sem_relatorio") {
        return !item.tem_relatorio;
      }
      return true;
    });
  }, [itens, termoBusca, filtroAtivo]);

  // ESTATÍSTICAS RÁPIDAS
  const estatisticas = useMemo(() => {
    const total = itens.length;
    const pendentes = itens.filter((i) => i.tem_relatorio && i.relatorio?.status_revisao === "pendente").length;
    const aprovados = itens.filter((i) => i.tem_relatorio && i.relatorio?.status_revisao === "aprovado").length;
    const semRelatorio = itens.filter((i) => !i.tem_relatorio).length;
    return { total, pendentes, aprovados, semRelatorio };
  }, [itens]);

  return (
    <View style={styles.container}>
      {/* CABEÇALHO */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.botaoVoltar} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#2562EB" />
          <Text style={styles.textoVoltar}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Relatórios de Exames</Text>
        <Text style={styles.subtitulo}>
          Extração de dados com IA, validação clínica e liberação para o paciente
        </Text>
      </View>

      {/* CARDS DE ESTATÍSTICAS RÁPIDAS */}
      <View style={styles.gridEstatisticas}>
        <View style={[styles.cardStat, styles.cardStatTotal]}>
          <Text style={styles.statValor}>{estatisticas.total}</Text>
          <Text style={styles.statLabel}>Total Exames</Text>
        </View>
        <TouchableOpacity
          style={[styles.cardStat, styles.cardStatPendente, filtroAtivo === "pendentes" && styles.cardStatAtivo]}
          onPress={() => setFiltroAtivo(filtroAtivo === "pendentes" ? "todos" : "pendentes")}
        >
          <Text style={[styles.statValor, { color: "#B45309" }]}>{estatisticas.pendentes}</Text>
          <Text style={styles.statLabel}>Pendentes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cardStat, styles.cardStatAprovado, filtroAtivo === "aprovados" && styles.cardStatAtivo]}
          onPress={() => setFiltroAtivo(filtroAtivo === "aprovados" ? "todos" : "aprovados")}
        >
          <Text style={[styles.statValor, { color: "#15803D" }]}>{estatisticas.aprovados}</Text>
          <Text style={styles.statLabel}>Aprovados</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cardStat, styles.cardStatSem, filtroAtivo === "sem_relatorio" && styles.cardStatAtivo]}
          onPress={() => setFiltroAtivo(filtroAtivo === "sem_relatorio" ? "todos" : "sem_relatorio")}
        >
          <Text style={[styles.statValor, { color: "#4B5563" }]}>{estatisticas.semRelatorio}</Text>
          <Text style={styles.statLabel}>Sem Laudo</Text>
        </TouchableOpacity>
      </View>

      {/* CAMPO DE PESQUISA */}
      <View style={styles.containerBusca}>
        <MaterialIcons name="search" size={22} color="#9CA3AF" style={styles.iconeBusca} />
        <TextInput
          style={styles.inputBusca}
          placeholder="Buscar por paciente ou arquivo..."
          placeholderTextColor="#9CA3AF"
          value={termoBusca}
          onChangeText={setTermoBusca}
        />
        {termoBusca.length > 0 && (
          <TouchableOpacity onPress={() => setTermoBusca("")}>
            <MaterialIcons name="close" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* CHIPS DE FILTRO */}
      <View style={styles.chipsContainer}>
        {(
          [
            { id: "todos", label: "Todos" },
            { id: "pendentes", label: "🟡 Pendentes de Avaliação" },
            { id: "aprovados", label: "🟢 Aprovados" },
            { id: "sem_relatorio", label: "⚪ Sem Laudo" },
          ] as { id: FiltroTipo; label: string }[]
        ).map((chip) => (
          <TouchableOpacity
            key={chip.id}
            style={[styles.chip, filtroAtivo === chip.id && styles.chipAtivo]}
            onPress={() => setFiltroAtivo(chip.id)}
          >
            <Text style={[styles.chipTexto, filtroAtivo === chip.id && styles.chipTextoAtivo]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* LISTAGEM DE EXAMES E RELATÓRIOS */}
      <ScrollView
        style={styles.conteudo}
        contentContainerStyle={styles.conteudoScroll}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={onRefresh} colors={["#2562EB"]} />}
      >
        {carregando ? (
          <View style={styles.estadoCarregando}>
            <ActivityIndicator size="large" color="#2562EB" />
            <Text style={styles.textoCarregando}>Carregando exames e laudos...</Text>
          </View>
        ) : itensFiltrados.length === 0 ? (
          <View style={styles.estadoVazio}>
            <MaterialIcons name="assignment-late" size={54} color="#9CA3AF" />
            <Text style={styles.tituloVazio}>Nenhum exame encontrado</Text>
            <Text style={styles.textoVazio}>
              {termoBusca
                ? "Nenhum resultado para a busca informada."
                : filtroAtivo !== "todos"
                ? "Não há exames com este filtro de status no momento."
                : "Seus pacientes ainda não enviaram nenhum exame em PDF."}
            </Text>
          </View>
        ) : (
          itensFiltrados.map((item) => {
            const temRelatorio = item.tem_relatorio && !!item.relatorio;
            const statusRevisao = item.relatorio?.status_revisao;
            const estaGerando = gerandoExameId === item.exame_id;

            return (
              <View key={item.exame_id} style={styles.cardItem}>
                {/* CABEÇALHO DO CARD: PACIENTE E BADGE DE STATUS */}
                <View style={styles.cardItemTopo}>
                  <View style={styles.pacienteInfo}>
                    <View style={styles.avatarPaciente}>
                      <MaterialIcons name="person" size={20} color="#2562EB" />
                    </View>
                    <View>
                      <Text style={styles.nomePaciente}>{item.nome_paciente}</Text>
                      <Text style={styles.dataExame}>
                        Envio do PDF: {item.data_envio || "Data recente"}
                      </Text>
                    </View>
                  </View>

                  {/* BADGE DE STATUS DO RELATÓRIO */}
                  {temRelatorio ? (
                    statusRevisao === "aprovado" ? (
                      <View style={[styles.badge, styles.badgeAprovado]}>
                        <MaterialIcons name="check-circle" size={14} color="#15803D" />
                        <Text style={[styles.badgeTexto, { color: "#15803D" }]}>Aprovado</Text>
                      </View>
                    ) : statusRevisao === "rejeitado" ? (
                      <View style={[styles.badge, styles.badgeRejeitado]}>
                        <MaterialIcons name="cancel" size={14} color="#B91C1C" />
                        <Text style={[styles.badgeTexto, { color: "#B91C1C" }]}>Rejeitado</Text>
                      </View>
                    ) : (
                      <View style={[styles.badge, styles.badgePendente]}>
                        <MaterialIcons name="schedule" size={14} color="#B45309" />
                        <Text style={[styles.badgeTexto, { color: "#B45309" }]}>Avaliação Pendente</Text>
                      </View>
                    )
                  ) : (
                    <View style={[styles.badge, styles.badgeSem]}>
                      <MaterialIcons name="hourglass-empty" size={14} color="#6B7280" />
                      <Text style={[styles.badgeTexto, { color: "#6B7280" }]}>Sem Laudo</Text>
                    </View>
                  )}
                </View>

                {/* INFORMAÇÕES DO ARQUIVO PDF */}
                <View style={styles.arquivoBox}>
                  <MaterialIcons name="picture-as-pdf" size={24} color="#EF4444" />
                  <Text style={styles.nomeArquivo} numberOfLines={1}>
                    {item.nome_arquivo}
                  </Text>
                  <TouchableOpacity
                    style={styles.botaoVerPdf}
                    onPress={() => handleVisualizarPDF(item.exame_id)}
                  >
                    <MaterialIcons name="visibility" size={16} color="#4B5563" />
                    <Text style={styles.textoBotaoVerPdf}>Ver PDF</Text>
                  </TouchableOpacity>
                </View>

                {/* AVISO DE LAUDO DISPONÍVEL OU PENDENTE */}
                {temRelatorio && (
                  <View style={styles.resumoBreveBox}>
                    <Text style={styles.resumoBreveTexto} numberOfLines={2}>
                      💬 {item.relatorio?.conteudo_json?.resumo || item.relatorio?.conteudo_relatorio || "Laudo estruturado disponível."}
                    </Text>
                    {statusRevisao === "aprovado" ? (
                      <Text style={styles.avisoPacienteLiberado}>
                        ✨ Liberado na tela do paciente
                      </Text>
                    ) : (
                      <Text style={styles.avisoRequerAvaliacao}>
                        ⚠️ Aguarda sua aprovação para liberação
                      </Text>
                    )}
                  </View>
                )}

                {/* BOTÕES DE AÇÃO */}
                <View style={styles.cardAcoes}>
                  {temRelatorio ? (
                    <TouchableOpacity
                      style={[styles.botaoAcao, styles.botaoAvaliar]}
                      onPress={() => {
                        setExameSelecionado(item);
                        setModalVisivel(true);
                      }}
                    >
                      <MaterialIcons
                        name={statusRevisao === "aprovado" ? "visibility" : "rate-review"}
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.textoBotaoAcao}>
                        {statusRevisao === "aprovado" ? "Visualizar Laudo" : "Avaliar e Aprovar Laudo"}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.botaoAcao, styles.botaoGerarIA, estaGerando && styles.botaoDesabilitado]}
                      disabled={estaGerando}
                      onPress={() => handleGerarRelatorio(item.exame_id)}
                    >
                      {estaGerando ? (
                        <>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={styles.textoBotaoAcao}>IA Analisando Exame...</Text>
                        </>
                      ) : (
                        <>
                          <MaterialIcons name="auto-awesome" size={18} color="#FFFFFF" />
                          <Text style={styles.textoBotaoAcao}>Gerar Laudo com IA</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ============================================================================== */}
      {/* MODAL DE AVALIAÇÃO E LEITURA DETALHADA DO LAUDO DE IA                         */}
      {/* ============================================================================== */}
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
              <Text style={styles.modalTitulo}>Laudo Clínico de IA</Text>
              <Text style={styles.modalSubtitulo} numberOfLines={1}>
                Paciente: {exameSelecionado?.nome_paciente} • {exameSelecionado?.nome_arquivo}
              </Text>
            </View>
            <TouchableOpacity style={styles.modalBotaoFechar} onPress={() => setModalVisivel(false)}>
              <MaterialIcons name="close" size={24} color="#4B5563" />
            </TouchableOpacity>
          </View>

          {/* STATUS ATUAL DO LAUDO */}
          <View style={styles.modalStatusBar}>
            <Text style={styles.modalStatusLabel}>Status de Liberação:</Text>
            {exameSelecionado?.relatorio?.status_revisao === "aprovado" ? (
              <View style={[styles.badge, styles.badgeAprovado]}>
                <MaterialIcons name="check-circle" size={14} color="#15803D" />
                <Text style={[styles.badgeTexto, { color: "#15803D" }]}>
                  Aprovado (Disponível ao Paciente)
                </Text>
              </View>
            ) : exameSelecionado?.relatorio?.status_revisao === "rejeitado" ? (
              <View style={[styles.badge, styles.badgeRejeitado]}>
                <MaterialIcons name="cancel" size={14} color="#B91C1C" />
                <Text style={[styles.badgeTexto, { color: "#B91C1C" }]}>Rejeitado</Text>
              </View>
            ) : (
              <View style={[styles.badge, styles.badgePendente]}>
                <MaterialIcons name="schedule" size={14} color="#B45309" />
                <Text style={[styles.badgeTexto, { color: "#B45309" }]}>
                  Pendente de Aprovação Profissional
                </Text>
              </View>
            )}
          </View>

          {/* CONTEÚDO COMPLETO DO LAUDO */}
          <ScrollView style={styles.modalConteudo} contentContainerStyle={{ paddingBottom: 120 }}>
            {/* CARD 1: SÍNTESE CLÍNICA */}
            <View style={styles.secaoBox}>
              <View style={styles.secaoTituloContainer}>
                <MaterialIcons name="psychology" size={22} color="#2562EB" />
                <Text style={styles.secaoTitulo}>Síntese Clínica da IA</Text>
              </View>
              <Text style={styles.resumoTexto}>
                {exameSelecionado?.relatorio?.conteudo_json?.resumo ||
                  exameSelecionado?.relatorio?.conteudo_relatorio ||
                  "Síntese não disponível."}
              </Text>
            </View>

            {/* CARD 2: PONTOS DE ATENÇÃO NUTRICIONAL */}
            {exameSelecionado?.relatorio?.conteudo_json?.pontos_de_atencao &&
              exameSelecionado.relatorio.conteudo_json.pontos_de_atencao.length > 0 && (
                <View style={[styles.secaoBox, styles.secaoBoxAtencao]}>
                  <View style={styles.secaoTituloContainer}>
                    <MaterialIcons name="warning" size={22} color="#D97706" />
                    <Text style={[styles.secaoTitulo, { color: "#B45309" }]}>
                      Pontos de Atenção Nutricional
                    </Text>
                  </View>
                  {exameSelecionado.relatorio.conteudo_json.pontos_de_atencao.map((ponto, idx) => (
                    <View key={idx} style={styles.itemPontoAtencao}>
                      <MaterialIcons name="chevron-right" size={20} color="#D97706" />
                      <Text style={styles.textoPontoAtencao}>{ponto}</Text>
                    </View>
                  ))}
                </View>
              )}

            {/* CARD 3: BIOMARCADORES E PARÂMETROS EXTRAÍDOS */}
            <View style={styles.secaoBox}>
              <View style={styles.secaoTituloContainer}>
                <MaterialIcons name="biotech" size={22} color="#2562EB" />
                <Text style={styles.secaoTitulo}>Biomarcadores Extraídos do Exame</Text>
              </View>

              {exameSelecionado?.relatorio?.conteudo_json?.resultados &&
              exameSelecionado.relatorio.conteudo_json.resultados.length > 0 ? (
                exameSelecionado.relatorio.conteudo_json.resultados.map((bio, index) => {
                  const tagInfo = {
                    dentro_da_referencia: { label: "Normal", bg: "#DCFCE7", text: "#15803D" },
                    acima: { label: "Elevado", bg: "#FEE2E2", text: "#B91C1C" },
                    abaixo: { label: "Baixo", bg: "#FEF3C7", text: "#B45309" },
                    ambiguo: { label: "Avaliar", bg: "#F3F4F6", text: "#4B5563" },
                  }[bio.classificacao] || { label: "Avaliar", bg: "#F3F4F6", text: "#4B5563" };

                  return (
                    <View key={index} style={styles.biomarcadorLinha}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.bioNome}>{bio.exame}</Text>
                        <Text style={styles.bioReferencia}>
                          Referência: {bio.referencia || "Não informada no laudo"}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.bioValor}>
                          {bio.valor !== null ? bio.valor : bio.valor_texto || "-"}{" "}
                          <Text style={styles.bioUnidade}>{bio.unidade || ""}</Text>
                        </Text>
                        <View style={[styles.bioTag, { backgroundColor: tagInfo.bg }]}>
                          <Text style={[styles.bioTagTexto, { color: tagInfo.text }]}>
                            {tagInfo.label}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.textoGenerico}>
                  Nenhum biomarcador detalhado foi identificado. Veja o laudo textual abaixo.
                </Text>
              )}
            </View>

            {/* CARD 4: OBSERVAÇÕES TÉCNICAS */}
            {exameSelecionado?.relatorio?.conteudo_json?.observacoes &&
              exameSelecionado.relatorio.conteudo_json.observacoes.length > 0 && (
                <View style={styles.secaoBox}>
                  <View style={styles.secaoTituloContainer}>
                    <MaterialIcons name="info-outline" size={20} color="#6B7280" />
                    <Text style={[styles.secaoTitulo, { fontSize: 16, color: "#4B5563" }]}>
                      Observações da Análise
                    </Text>
                  </View>
                  {exameSelecionado.relatorio.conteudo_json.observacoes.map((obs, idx) => (
                    <Text key={idx} style={styles.textoObservacao}>
                      • {obs}
                    </Text>
                  ))}
                </View>
              )}

            {/* AVISO ÉTICO / RESPONSABILIDADE */}
            <View style={styles.avisoEticoBox}>
              <MaterialIcons name="verified-user" size={20} color="#6B7280" />
              <Text style={styles.avisoEticoTexto}>
                Em conformidade com as diretrizes do Conselho Federal de Nutricionistas (CFN),
                este laudo gerado por IA atua como ferramenta de triagem e suporte à decisão.
                A interpretação clínica, conduta dietoterápica e liberação são de sua
                responsabilidade profissional exclusiva.
              </Text>
            </View>
          </ScrollView>

          {/* BARRA FIXA INFERIOR DE DECISÃO PROFISSIONAL */}
          <View style={styles.modalBarraAcoes}>
            <TouchableOpacity
              style={styles.modalBotaoPDF}
              onPress={() => {
                if (exameSelecionado?.exame_id) handleVisualizarPDF(exameSelecionado.exame_id);
              }}
            >
              <MaterialIcons name="picture-as-pdf" size={20} color="#4B5563" />
              <Text style={styles.textoBotaoPDF}>PDF Original</Text>
            </TouchableOpacity>

            {exameSelecionado?.relatorio?.status_revisao === "aprovado" ? (
              <TouchableOpacity
                style={[styles.modalBotaoRejeitar, processandoRevisao && styles.botaoDesabilitado]}
                disabled={processandoRevisao}
                onPress={() => handleRevisarRelatorio("rejeitado")}
              >
                <MaterialIcons name="undo" size={20} color="#B91C1C" />
                <Text style={styles.textoBotaoRejeitar}>Revogar Aprovação</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.modalBotaoRejeitar, processandoRevisao && styles.botaoDesabilitado]}
                  disabled={processandoRevisao}
                  onPress={() => handleRevisarRelatorio("rejeitado")}
                >
                  <MaterialIcons name="close" size={20} color="#B91C1C" />
                  <Text style={styles.textoBotaoRejeitar}>Rejeitar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBotaoAprovar, processandoRevisao && styles.botaoDesabilitado]}
                  disabled={processandoRevisao}
                  onPress={() => handleRevisarRelatorio("aprovado")}
                >
                  {processandoRevisao ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialIcons name="check" size={22} color="#FFFFFF" />
                      <Text style={styles.textoBotaoAprovar}>Aprovar e Liberar</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ==============================================================================
// ESTILOS VISUAIS DA TELA
// ==============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  botaoVoltar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  textoVoltar: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2562EB",
    marginLeft: 4,
  },
  titulo: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1F2937",
  },
  subtitulo: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
    lineHeight: 20,
  },

  // ESTATÍSTICAS
  gridEstatisticas: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: "#FFFFFF",
  },
  cardStat: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardStatTotal: {
    backgroundColor: "#EFF6FF",
    borderColor: "#DBEAFE",
  },
  cardStatPendente: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  cardStatAprovado: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
  },
  cardStatSem: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  cardStatAtivo: {
    borderWidth: 2,
    borderColor: "#2562EB",
  },
  statValor: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E40AF",
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
  },

  // BUSCA
  containerBusca: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  iconeBusca: {
    marginRight: 8,
  },
  inputBusca: {
    flex: 1,
    fontSize: 15,
    color: "#1F2937",
    padding: 0,
  },

  // CHIPS
  chipsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
  },
  chipAtivo: {
    backgroundColor: "#2562EB",
  },
  chipTexto: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "500",
  },
  chipTextoAtivo: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },

  // LISTAGEM
  conteudo: {
    flex: 1,
  },
  conteudoScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  cardItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardItemTopo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  pacienteInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  avatarPaciente: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  nomePaciente: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
  },
  dataExame: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },

  // BADGES
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeAprovado: {
    backgroundColor: "#DCFCE7",
  },
  badgePendente: {
    backgroundColor: "#FEF3C7",
  },
  badgeRejeitado: {
    backgroundColor: "#FEE2E2",
  },
  badgeSem: {
    backgroundColor: "#F3F4F6",
  },
  badgeTexto: {
    fontSize: 11,
    fontWeight: "700",
  },

  // ARQUIVO
  arquivoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  nomeArquivo: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
    marginLeft: 8,
    fontWeight: "500",
  },
  botaoVerPdf: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
    gap: 4,
  },
  textoBotaoVerPdf: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600",
  },

  // RESUMO BREVE
  resumoBreveBox: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#2562EB",
  },
  resumoBreveTexto: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  avisoPacienteLiberado: {
    fontSize: 12,
    color: "#15803D",
    fontWeight: "bold",
    marginTop: 6,
  },
  avisoRequerAvaliacao: {
    fontSize: 12,
    color: "#D97706",
    fontWeight: "bold",
    marginTop: 6,
  },

  // BOTÕES CARD
  cardAcoes: {
    flexDirection: "row",
    gap: 10,
  },
  botaoAcao: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  botaoGerarIA: {
    backgroundColor: "#2562EB",
  },
  botaoAvaliar: {
    backgroundColor: "#1E40AF",
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  textoBotaoAcao: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },

  // ESTADOS
  estadoCarregando: {
    paddingVertical: 50,
    alignItems: "center",
  },
  textoCarregando: {
    marginTop: 12,
    fontSize: 15,
    color: "#6B7280",
  },
  estadoVazio: {
    paddingVertical: 60,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  tituloVazio: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#374151",
    marginTop: 12,
  },
  textoVazio: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },

  // MODAL
  modalContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitulo: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0F172A",
  },
  modalSubtitulo: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  modalBotaoFechar: {
    padding: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
  },
  modalStatusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalStatusLabel: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },
  modalConteudo: {
    flex: 1,
    padding: 16,
  },

  // SEÇÕES DO LAUDO
  secaoBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  secaoBoxAtencao: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  secaoTituloContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  secaoTitulo: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
  },
  resumoTexto: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 22,
  },
  itemPontoAtencao: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  textoPontoAtencao: {
    flex: 1,
    fontSize: 14,
    color: "#92400E",
    fontWeight: "500",
    lineHeight: 20,
  },

  // BIOMARCADORES
  biomarcadorLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  bioNome: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  bioReferencia: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  bioValor: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
  },
  bioUnidade: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "normal",
  },
  bioTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  bioTagTexto: {
    fontSize: 11,
    fontWeight: "bold",
  },
  textoGenerico: {
    fontSize: 14,
    color: "#64748B",
    fontStyle: "italic",
  },
  textoObservacao: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 4,
    lineHeight: 18,
  },

  // AVISO ÉTICO
  avisoEticoBox: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    padding: 14,
    borderRadius: 10,
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 20,
  },
  avisoEticoTexto: {
    flex: 1,
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },

  // BARRA DE AÇÕES DO MODAL
  modalBarraAcoes: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    flexDirection: "row",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 8,
  },
  modalBotaoPDF: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    gap: 6,
  },
  textoBotaoPDF: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "600",
  },
  modalBotaoRejeitar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    gap: 6,
  },
  textoBotaoRejeitar: {
    fontSize: 14,
    color: "#B91C1C",
    fontWeight: "bold",
  },
  modalBotaoAprovar: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#16A34A",
    gap: 6,
  },
  textoBotaoAprovar: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});
