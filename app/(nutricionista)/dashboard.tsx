// ==============================================================================
// PAINEL PRINCIPAL DO NUTRICIONISTA (DASHBOARD) - WESHDIET
// ==============================================================================
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function DashboardNutricionistaScreen() {
  const router = useRouter();
  const { usuario, signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert("Sair da Conta", "Deseja realmente encerrar sua sessão profissional?", [
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
          <Text style={styles.saudacao}>Olá, Dr(a). {usuario?.nome || "Nutricionista"}</Text>
          <View style={styles.badgePapel}>
            <Text style={styles.textoBadge}>🩺 Nutricionista</Text>
            {usuario?.crn ? (
              <Text style={styles.textoCrn}> | {usuario.crn}</Text>
            ) : null}
          </View>
        </View>

        <TouchableOpacity style={styles.botaoSair} onPress={handleLogout}>
          <Text style={styles.textoBotaoSair}>Sair</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Painel Clínico</Text>
      <Text style={styles.subtitle}>
        Gestão de pacientes, diagnósticos, planos e análises inteligentes.
      </Text>

      {/* MÉTRICAS / RESUMO */}
      <View style={styles.gridResumo}>
        <View style={styles.cardResumo}>
          <Text style={styles.cardTitle}>Pacientes Ativos</Text>
          <Text style={styles.cardNumber}>24</Text>
        </View>

        <View style={styles.cardResumo}>
          <Text style={styles.cardTitle}>Exames Pendentes</Text>
          <Text style={styles.cardNumber}>3</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Operações Clínicas</Text>

      {/* CARD: GESTÃO DE PACIENTES */}
      <Pressable
        style={styles.cardAcao}
        onPress={() => router.push("/(nutricionista)/pacientes")}
      >
        <Text style={styles.iconeAcao}>👥</Text>
        <View style={styles.infoAcao}>
          <Text style={styles.tituloAcao}>Meus Pacientes</Text>
          <Text style={styles.subtituloAcao}>
            Listar pacientes vinculados, prontuários e históricos.
          </Text>
        </View>
      </Pressable>

      {/* CARD: ANÁLISE COM IA */}
      <Pressable
        style={styles.cardAcao}
        onPress={() => router.push("/(nutricionista)/analise-ia")}
      >
        <Text style={styles.iconeAcao}>🤖</Text>
        <View style={styles.infoAcao}>
          <Text style={styles.tituloAcao}>Assistente & Análise IA</Text>
          <Text style={styles.subtituloAcao}>
            Analisar parâmetros nutricionais e gerar diagnósticos assistidos por IA.
          </Text>
        </View>
      </Pressable>

      {/* CARD: EXAMES LABORATORIAIS */}
      <Pressable
        style={styles.cardAcao}
        onPress={() => router.push("/(nutricionista)/exames")}
      >
        <Text style={styles.iconeAcao}>📄</Text>
        <View style={styles.infoAcao}>
          <Text style={styles.tituloAcao}>Exames Laboratoriais</Text>
          <Text style={styles.subtituloAcao}>
            Consultar PDFs e extrações analíticas dos pacientes autorizados.
          </Text>
        </View>
      </Pressable>

      {/* CARD: GERAÇÃO DE PLANOS ALIMENTARES */}
      <Pressable
        style={styles.cardAcao}
        onPress={() => router.push("/(nutricionista)/plano")}
      >
        <Text style={styles.iconeAcao}>🥗</Text>
        <View style={styles.infoAcao}>
          <Text style={styles.tituloAcao}>Gerador de Plano Alimentar</Text>
          <Text style={styles.subtituloAcao}>
            Construir e prescrever dietas personalizadas com tabelas nutricionais.
          </Text>
        </View>
      </Pressable>

      {/* CARD: EVOLUÇÃO CLÍNICA */}
      <Pressable
        style={styles.cardAcao}
        onPress={() => router.push("/(nutricionista)/evolucao")}
      >
        <Text style={styles.iconeAcao}>📈</Text>
        <View style={styles.infoAcao}>
          <Text style={styles.tituloAcao}>Acompanhamento & Evolução</Text>
          <Text style={styles.subtituloAcao}>
            Monitorar progresso antropométrico e metas terapêuticas.
          </Text>
        </View>
      </Pressable>

      {/* CARD: RELATÓRIOS CLÍNICOS */}
      <Pressable
        style={styles.cardAcao}
        onPress={() => router.push("/(nutricionista)/relatorio")}
      >
        <Text style={styles.iconeAcao}>📊</Text>
        <View style={styles.infoAcao}>
          <Text style={styles.tituloAcao}>Emissão de Relatórios</Text>
          <Text style={styles.subtituloAcao}>
            Emitir pareceres clínicos e relatórios estruturados de exames.
          </Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
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
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  saudacao: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
  },
  badgePapel: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  textoBadge: {
    fontSize: 13,
    color: "#059669",
    fontWeight: "600",
  },
  textoCrn: {
    fontSize: 12,
    color: "#6B7280",
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  gridResumo: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  cardResumo: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
  },
  cardNumber: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#059669",
    marginTop: 6,
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
});

