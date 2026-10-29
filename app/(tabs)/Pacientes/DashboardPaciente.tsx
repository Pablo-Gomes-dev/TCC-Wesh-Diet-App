// ==============================================================================
// DASHBOARD DO PACIENTE - WESHDIET
// ==============================================================================
import { useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";

export default function PacientesScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity
        style={styles.botaoVoltar}
        onPress={() => router.back()}
      >
        <Text style={styles.textoVoltar}>⬅ Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Pacientes</Text>
      <Text style={styles.subtitle}>
        Gerencie suas informações e recursos do paciente.
      </Text>

      <Pressable
        style={styles.Button}
        onPress={() => router.push("/(paciente)/plano")}
      >
        <Text style={styles.ButtonText}>Plano alimentar.</Text>
      </Pressable>

      <Pressable
        style={styles.Button}
        onPress={() => router.push("/(paciente)/exames")}
      >
        <Text style={styles.ButtonText}>Exames.</Text>
      </Pressable>

      <Pressable
        style={styles.Button}
        onPress={() => router.push("/(paciente)/evolucao")}
      >
        <Text style={styles.ButtonText}>Evolução.</Text>
      </Pressable>

      <Pressable
        style={styles.Button}
        onPress={() => router.push("/(paciente)/perfil")}
      >
        <Text style={styles.ButtonText}>Detalhes do paciente.</Text>
      </Pressable>

      <Pressable
        style={styles.Button}
        onPress={() => router.push("/(paciente)/check-ins")}
      >
        <Text style={styles.ButtonText}>Check-ins.</Text>
      </Pressable>

      <Pressable
        style={styles.Button}
        onPress={() => router.push("/(paciente)/relatorio")}
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
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  ButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
});
