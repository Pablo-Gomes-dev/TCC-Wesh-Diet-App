// ==============================================================================
// PAINEL PRINCIPAL DO PACIENTE (DASHBOARD) - WESHDIET
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

export default function DashboardPacienteScreen() {
  const router = useRouter();
  const { usuario, signOut } = useAuth();

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

      {/* CARD: CHECK-INS */}
      <Pressable
        style={styles.cardAcao}
        onPress={() => router.push("/(paciente)/check-ins")}
      >
        <Text style={styles.iconeAcao}>✅</Text>
        <View style={styles.infoAcao}>
          <Text style={styles.tituloAcao}>Check-ins</Text>
          <Text style={styles.subtituloAcao}>
            Registre seus registros diários e reporte ao nutricionista.
          </Text>
        </View>
      </Pressable>

      {/* CARD: RELATÓRIOS */}
      <Pressable
        style={styles.cardAcao}
        onPress={() => router.push("/(paciente)/relatorio")}
      >
        <Text style={styles.iconeAcao}>📊</Text>
        <View style={styles.infoAcao}>
          <Text style={styles.tituloAcao}>Relatórios</Text>
          <Text style={styles.subtituloAcao}>
            Consulte os relatórios analíticos dos seus exames e avaliações.
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
    color: "#2562EB",
    fontWeight: "600",
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
    fontSize: 22,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
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

