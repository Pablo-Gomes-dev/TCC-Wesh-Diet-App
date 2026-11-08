// ==============================================================================
// PAINEL PRINCIPAL DO PACIENTE (DASHBOARD) - WISHDIET
// ==============================================================================
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.0.0.23:8000";

interface NutricionistaVinculado {
  id: number;
  nome: string;
  email: string;
  crn?: string;
  data_vinculo: string;
}

export default function DashboardPacienteScreen() {
  const router = useRouter();
  const { usuario, signOut } = useAuth();

  const [nutricionista, setNutricionista] = useState<NutricionistaVinculado | null>(null);
  const [carregandoNutri, setCarregandoNutri] = useState(true);
  const [modalVinculoVisivel, setModalVinculoVisivel] = useState(false);
  const [codigoInput, setCodigoInput] = useState("");
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);

  const carregarMeuNutricionista = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("@wishdiet:token");
      if (!token) return;

      const resp = await fetch(`${API_BASE_URL}/paciente/meu-nutricionista`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.ok) {
        const dados = await resp.json();
        if (dados.vinculado && dados.nutricionista) {
          setNutricionista(dados.nutricionista);
        } else {
          setNutricionista(null);
        }
      }
    } catch (err) {
      console.warn("Erro ao buscar nutricionista:", err);
    } finally {
      setCarregandoNutri(false);
    }
  }, []);

  useEffect(() => {
    carregarMeuNutricionista();
  }, [carregarMeuNutricionista]);

  const handleVincularPorCodigo = async () => {
    if (!codigoInput.trim()) {
      Alert.alert("Campo obrigatório", "Por favor, digite o código de vínculo fornecido pelo nutricionista.");
      return;
    }

    setEnviandoCodigo(true);
    try {
      const token = await AsyncStorage.getItem("@wishdiet:token");
      const resp = await fetch(`${API_BASE_URL}/paciente/vincular-por-codigo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ codigo: codigoInput.trim() }),
      });

      const dados = await resp.json();

      if (resp.ok) {
        Alert.alert("Sucesso! 🎉", dados.mensagem || "Vínculo realizado com sucesso!");
        setCodigoInput("");
        setModalVinculoVisivel(false);
        carregarMeuNutricionista();
      } else {
        Alert.alert("Atenção", dados.detail || "Não foi possível vincular com este código.");
      }
    } catch (err) {
      Alert.alert("Erro", "Falha de conexão com o servidor.");
    } finally {
      setEnviandoCodigo(false);
    }
  };

  const handleDesvincular = () => {
    Alert.alert(
      "Desvincular Nutricionista",
      "Deseja realmente encerrar o acompanhamento com este profissional? O nutricionista deixará de ter acesso ao seu prontuário.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desvincular",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("@wishdiet:token");
              const resp = await fetch(`${API_BASE_URL}/paciente/desvincular-nutricionista`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
              });

              if (resp.ok) {
                Alert.alert("Desvinculado", "Acompanhamento encerrado.");
                setNutricionista(null);
              } else {
                const erro = await resp.json().catch(() => ({}));
                Alert.alert("Erro", erro.detail || "Não foi possível desvincular.");
              }
            } catch (err) {
              Alert.alert("Erro", "Falha ao conectar ao servidor.");
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert("Sair da Conta", "Deseja realmente encerrar sua sessão?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* CABEÇALHO */}
      <View style={styles.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={styles.saudacao}>Olá, {usuario?.nome || "Paciente"}</Text>
          <View style={styles.badgePapel}>
            <Text style={styles.textoBadge}>👤 Paciente</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.botaoSair} onPress={handleLogout}>
          <Text style={styles.textoBotaoSair}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* CARD DE VÍNCULO COM NUTRICIONISTA */}
      {carregandoNutri ? (
        <View style={styles.cardVinculoLoading}>
          <ActivityIndicator size="small" color="#2562EB" />
          <Text style={styles.textoVinculoLoading}>Consultando seu nutricionista...</Text>
        </View>
      ) : nutricionista ? (
        <View style={styles.cardNutriAtivo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.labelNutriAtivo}>SEU NUTRICIONISTA RESPONSÁVEL</Text>
            <Text style={styles.nomeNutriAtivo}>🩺 {nutricionista.nome}</Text>
            {nutricionista.crn ? (
              <Text style={styles.crnNutriAtivo}>CRN: {nutricionista.crn}</Text>
            ) : null}
            <Text style={styles.dataVinculoAtivo}>
              Acompanhamento ativo desde {nutricionista.data_vinculo}
            </Text>
          </View>
          <TouchableOpacity style={styles.botaoDesvincularNutri} onPress={handleDesvincular}>
            <Text style={styles.textoDesvincularNutri}>Trocar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.cardVincularPendente}
          onPress={() => setModalVinculoVisivel(true)}
        >
          <Text style={styles.iconeVincular}>🔗</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.tituloVincular}>Vincular ao seu Nutricionista</Text>
            <Text style={styles.subtituloVincular}>
              Possui o código do seu nutricionista? Toque aqui para conectar seu acompanhamento.
            </Text>
          </View>
          <Text style={styles.setaVincular}>➔</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Meu Espaço Nutricional</Text>
      <Text style={styles.subtitle}>
        Acompanhe sua rotina, planos, exames e evolução.
      </Text>

      {/* CARD: PLANO ALIMENTAR */}
      <Pressable
        style={styles.cardAcao}
        onPress={() => router.push("/(paciente)/plano")}
      >
        <Text style={styles.iconeAcao}>🥗</Text>
        <View style={styles.infoAcao}>
          <Text style={styles.tituloAcao}>Plano Alimentar</Text>
          <Text style={styles.subtituloAcao}>
            Consulte sua dieta prescrita e horários das refeições.
          </Text>
        </View>
      </Pressable>

      {/* CARD: MEUS EXAMES */}
      <Pressable
        style={styles.cardAcao}
        onPress={() => router.push("/(paciente)/exames")}
      >
        <Text style={styles.iconeAcao}>📄</Text>
        <View style={styles.infoAcao}>
          <Text style={styles.tituloAcao}>Meus Exames</Text>
          <Text style={styles.subtituloAcao}>
            Envie laudos em PDF e acompanhe seus exames laboratoriais.
          </Text>
        </View>
      </Pressable>

      {/* CARD: EVOLUÇÃO */}
      <Pressable
        style={styles.cardAcao}
        onPress={() => router.push("/(paciente)/evolucao")}
      >
        <Text style={styles.iconeAcao}>📈</Text>
        <View style={styles.infoAcao}>
          <Text style={styles.tituloAcao}>Evolução Nutricional</Text>
          <Text style={styles.subtituloAcao}>
            Acompanhe seu progresso, peso e histórico de metas.
          </Text>
        </View>
      </Pressable>

      {/* CARD: MEU PERFIL / MEDIDAS & IMC */}
      <Pressable
        style={styles.cardAcao}
        onPress={() => router.push("/(paciente)/perfil")}
      >
        <Text style={styles.iconeAcao}>⚖️</Text>
        <View style={styles.infoAcao}>
          <Text style={styles.tituloAcao}>Meu Perfil & Medidas</Text>
          <Text style={styles.subtituloAcao}>
            Consulte e atualize seu peso, altura, restrições e IMC.
          </Text>
        </View>
      </Pressable>

      {/* MODAL PARA DIGITAR O CÓDIGO DO NUTRI */}
      <Modal visible={modalVinculoVisivel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Conectar ao Nutricionista</Text>
            <Text style={styles.modalDescricao}>
              Digite o código fornecido pelo seu nutricionista (ex: NUTRI-A1B2C3) para liberar o acesso seguro ao seu acompanhamento:
            </Text>

            <TextInput
              style={styles.inputCodigo}
              placeholder="Ex: NUTRI-9F8A12"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              value={codigoInput}
              onChangeText={setCodigoInput}
            />

            <View style={styles.modalBotoes}>
              <TouchableOpacity
                style={styles.botaoCancelarModal}
                onPress={() => {
                  setCodigoInput("");
                  setModalVinculoVisivel(false);
                }}
              >
                <Text style={styles.textoCancelarModal}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoConfirmarModal}
                onPress={handleVincularPorCodigo}
                disabled={enviandoCodigo}
              >
                {enviandoCodigo ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.textoConfirmarModal}>Conectar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  cabecalho: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  saudacao: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1F2937",
  },
  badgePapel: {
    alignSelf: "flex-start",
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  textoBadge: {
    color: "#1D4ED8",
    fontWeight: "bold",
    fontSize: 12,
  },
  botaoSair: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  textoBotaoSair: {
    color: "#DC2626",
    fontWeight: "bold",
    fontSize: 13,
  },
  cardVinculoLoading: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 20,
  },
  textoVinculoLoading: {
    marginLeft: 8,
    fontSize: 13,
    color: "#6B7280",
  },
  cardNutriAtivo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  labelNutriAtivo: {
    fontSize: 11,
    fontWeight: "700",
    color: "#065F46",
  },
  nomeNutriAtivo: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#047857",
    marginTop: 2,
  },
  crnNutriAtivo: {
    fontSize: 12,
    color: "#065F46",
    marginTop: 1,
  },
  dataVinculoAtivo: {
    fontSize: 11,
    color: "#6EE7B7",
    marginTop: 3,
  },
  botaoDesvincularNutri: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginLeft: 8,
  },
  textoDesvincularNutri: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600",
  },
  cardVincularPendente: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  iconeVincular: {
    fontSize: 26,
    marginRight: 12,
  },
  tituloVincular: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1D4ED8",
  },
  subtituloVincular: {
    fontSize: 12,
    color: "#3B82F6",
    marginTop: 2,
    lineHeight: 16,
  },
  setaVincular: {
    fontSize: 18,
    color: "#2562EB",
    fontWeight: "bold",
    marginLeft: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
  },
  cardAcao: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    elevation: 1,
  },
  iconeAcao: {
    fontSize: 28,
    marginRight: 14,
  },
  infoAcao: {
    flex: 1,
  },
  tituloAcao: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 2,
  },
  subtituloAcao: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 22,
    width: "100%",
    maxWidth: 380,
  },
  modalTitulo: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  modalDescricao: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
    marginBottom: 14,
  },
  inputCodigo: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 2,
    textAlign: "center",
    color: "#1F2937",
    marginBottom: 16,
  },
  modalBotoes: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  botaoCancelarModal: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  textoCancelarModal: {
    fontSize: 14,
    color: "#4B5563",
    fontWeight: "600",
  },
  botaoConfirmarModal: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#2562EB",
  },
  textoConfirmarModal: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});
