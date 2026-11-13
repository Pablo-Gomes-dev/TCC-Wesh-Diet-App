// ==============================================================================
// TELA DE GESTÃO DE PACIENTES DO NUTRICIONISTA - WISHDIET
// ==============================================================================
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiFetch } from "@/services/api";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

interface PacienteVinculado {
  id: number;
  nome: string;
  email: string;
  objetivo: string;
  restricoes: string;
  observacoes: string;
  data_vinculo: string;
  status: string;
}

export default function PacientesNutricionistaScreen() {
  const router = useRouter();
  const { usuario } = useAuth();

  const [pacientes, setPacientes] = useState<PacienteVinculado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [codigoVinculo, setCodigoVinculo] = useState<string | null>(
    usuario?.codigo_vinculo || null,
  );
  const [modalCodigoVisivel, setModalCodigoVisivel] = useState(false);

  const carregarCodigoVinculo = useCallback(async () => {
    try {
      const dados = await apiFetch<{ codigo_vinculo: string }>(
        "/nutricionista/codigo-vinculo",
      );
      setCodigoVinculo(dados.codigo_vinculo);
    } catch (err) {
      console.warn("Erro ao carregar código de vínculo:", err);
    }
  }, []);

  const carregarPacientes = useCallback(async () => {
    try {
      const dados = await apiFetch<{ pacientes: PacienteVinculado[] }>(
        "/nutricionista/meus-pacientes",
      );
      setPacientes(dados.pacientes || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        Alert.alert("Erro", "Sessão expirada. Faça login novamente.");
        router.replace("/login");
      } else {
        Alert.alert(
          "Atenção",
          err instanceof Error
            ? err.message
            : "Não foi possível carregar os pacientes.",
        );
      }
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [router]);

  useEffect(() => {
    carregarPacientes();
    carregarCodigoVinculo();
  }, [carregarPacientes, carregarCodigoVinculo]);

  const onRefresh = () => {
    setAtualizando(true);
    carregarPacientes();
    carregarCodigoVinculo();
  };

  const handleDesvincular = (pacienteId: number, nomePaciente: string) => {
    Alert.alert(
      "Encerrar Vínculo",
      `Deseja realmente desvincular o paciente ${nomePaciente}? Você deixará de ter acesso ao acompanhamento e prontuário deste paciente.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desvincular",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(
                `/nutricionista/desvincular-paciente/${pacienteId}`,
                {
                  method: "PATCH",
                },
              );
              Alert.alert("Sucesso", "Vínculo encerrado com sucesso.");
              carregarPacientes();
            } catch (err) {
              Alert.alert(
                "Erro",
                err instanceof Error
                  ? err.message
                  : "Falha ao desvincular paciente.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* CABEÇALHO */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={() => router.back()}
        >
          <Text style={styles.textoVoltar}>⬅ Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Meus Pacientes</Text>
        <Text style={styles.subtitulo}>
          Gerencie os pacientes vinculados ao seu CRN com proteção clínica
          total.
        </Text>

        {/* CARD COM O CÓDIGO DE VÍNCULO */}
        <View style={styles.cardCodigo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.labelCodigo}>SEU CÓDIGO DE VÍNCULO:</Text>
            <Text style={styles.valorCodigo}>
              {codigoVinculo || "Carregando..."}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.botaoCompartilhar}
            onPress={() => setModalCodigoVisivel(true)}
          >
            <Text style={styles.textoBotaoCompartilhar}>ℹ️ Instruções</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* LISTA DE PACIENTES VINCULADOS */}
      {carregando ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2562EB" />
          <Text style={styles.loadingText}>
            Carregando pacientes autorizados...
          </Text>
        </View>
      ) : (
        <FlatList
          data={pacientes}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl refreshing={atualizando} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>Nenhum paciente vinculado</Text>
              <Text style={styles.emptySubtitle}>
                Compartilhe seu código de vínculo{" "}
                <Text style={{ fontWeight: "bold", color: "#2562EB" }}>
                  {codigoVinculo || "NUTRI-..."}
                </Text>{" "}
                com seus pacientes para que eles se vinculem no aplicativo.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.cardPaciente}>
              <Pressable
                style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                onPress={() => router.push("/(nutricionista)/analise-ia")}
              >
                <View style={styles.avatar}>
                  <Text style={styles.textoAvatar}>
                    {item.nome.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.infoPaciente}>
                  <Text style={styles.nomePaciente}>{item.nome}</Text>
                  <Text style={styles.detalhesPaciente}>
                    🎯 Objetivo: {item.objetivo}
                  </Text>
                  <Text style={styles.dataVinculo}>
                    📅 Vinculado em: {item.data_vinculo || "Recente"}
                  </Text>
                </View>
              </Pressable>

              <TouchableOpacity
                style={styles.botaoDesvincular}
                onPress={() => handleDesvincular(item.id, item.nome)}
              >
                <Text style={styles.textoDesvincular}>Encerrar</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* MODAL COM INSTRUÇÕES SOBRE O CÓDIGO */}
      <Modal visible={modalCodigoVisivel} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitulo}>Como vincular pacientes?</Text>
            <Text style={styles.modalTexto}>
              1. Informe seu código exclusivo:
            </Text>
            <View style={styles.modalBoxCodigo}>
              <Text style={styles.modalTextoCodigo}>{codigoVinculo}</Text>
            </View>
            <Text style={styles.modalTexto}>
              2. O paciente acessa o aplicativo dele, vai em &quot;Vincular
              Nutricionista&quot; e digita este código.
            </Text>
            <Text style={styles.modalTexto}>
              3. Automaticamente o prontuário, exames e dados do paciente ficam
              disponíveis aqui de forma segura e protegida por regra clínica
              (Regra de Ouro).
            </Text>

            <TouchableOpacity
              style={styles.modalBotaoFechar}
              onPress={() => setModalCodigoVisivel(false)}
            >
              <Text style={styles.modalBotaoFecharTexto}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  botaoVoltar: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  textoVoltar: {
    fontSize: 15,
    color: "#2562EB",
    fontWeight: "600",
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
    marginBottom: 16,
  },
  cardCodigo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    padding: 12,
  },
  labelCodigo: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1E40AF",
  },
  valorCodigo: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1D4ED8",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  botaoCompartilhar: {
    backgroundColor: "#2562EB",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  textoBotaoCompartilhar: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#6B7280",
  },
  lista: {
    padding: 16,
    flexGrow: 1,
  },
  cardPaciente: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E0F2FE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textoAvatar: {
    color: "#0369A1",
    fontSize: 18,
    fontWeight: "bold",
  },
  infoPaciente: {
    flex: 1,
  },
  nomePaciente: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
  },
  detalhesPaciente: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 2,
  },
  dataVinculo: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  botaoDesvincular: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginLeft: 8,
  },
  textoDesvincular: {
    fontSize: 12,
    color: "#B91C1C",
    fontWeight: "600",
  },
  emptyContainer: {
    paddingVertical: 50,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 22,
    width: "100%",
    maxWidth: 380,
  },
  modalTitulo: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 14,
  },
  modalTexto: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 8,
  },
  modalBoxCodigo: {
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalTextoCodigo: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2562EB",
    letterSpacing: 2,
  },
  modalBotaoFechar: {
    backgroundColor: "#2562EB",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  modalBotaoFecharTexto: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 15,
  },
});
