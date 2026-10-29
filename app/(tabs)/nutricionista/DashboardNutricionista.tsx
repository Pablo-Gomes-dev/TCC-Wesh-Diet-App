// ==============================================================================
// DASHBOARD DO NUTRICIONISTA - WESHDIET
// ==============================================================================
import { useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";

export default function NutricionistaScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity
        style={styles.botaoVoltar}
        onPress={() => router.back()}
      >
        <Text style={styles.textoVoltar}>⬅ Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Painel Clínico</Text>
      <Text style={styles.subtitle}>
        Gerencie seus pacientes, avaliações, planos e análises.
      </Text>

      <Pressable
        style={styles.Button}
        onPress={() => router.push("/(nutricionista)/pacientes")}
      >
        <Text style={styles.ButtonText}>Meus Pacientes.</Text>
      </Pressable>

      <Pressable
        style={styles.Button}
        onPress={() => router.push("/(nutricionista)/analise-ia")}
      >
        <Text style={styles.ButtonText}>Análise com IA.</Text>
      </Pressable>

      <Pressable
        style={styles.Button}
        onPress={() => router.push("/(nutricionista)/exames")}
      >
        <Text style={styles.ButtonText}>Exames Laboratoriais.</Text>
      </Pressable>

      <Pressable
        style={styles.Button}
        onPress={() => router.push("/(nutricionista)/plano")}
      >
        <Text style={styles.ButtonText}>Gerar Plano Alimentar.</Text>
      </Pressable>

      <Pressable
        style={styles.Button}
        onPress={() => router.push("/(nutricionista)/evolucao")}
      >
        <Text style={styles.ButtonText}>Acompanhamento & Evolução.</Text>
      </Pressable>

      <Pressable
        style={styles.Button}
        onPress={() => router.push("/(nutricionista)/relatorio")}
      >
        <Text style={styles.ButtonText}>Relatórios.</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 40,
  },
  botaoVoltar: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  textoVoltar: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2562EB",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  Button: {
    backgroundColor: "#059669",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  ButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
