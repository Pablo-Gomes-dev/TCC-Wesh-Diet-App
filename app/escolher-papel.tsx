// TELA DDE ESCOLHA DE PAPEL (PRIMEIRO ACESSO COM GOOGLE) - WISHDIET

import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/services/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function EscolherPapelScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { idToken } = useLocalSearchParams<{ idToken: string }>();

  const [tipoUsuario, setTipoUsuario] = useState<"paciente" | "nutricionista">(
    "paciente",
  );
  const [crn, setCrn] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleConfirmar = async () => {
    if (!idToken) {
      Alert.alert("Sessão expirada", "Tente entrar com o Google novamente. ");
      router.replace("/login");
      return;
    }
    if (tipoUsuario === "nutricionista" && !crn.trim()) {
      Alert.alert(
        "CRN obrigatório",
        "Informe seu registro no CRN para continuar.",
      );
      return;
    }

    try {
      setCarregando(true);

      const resposta = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_token: idToken,
          tipo_usuario: tipoUsuario,
          crn: tipoUsuario === "nutricionista" ? crn.trim() : null,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        const detalhe = dados?.detail;
        throw new Error(
          typeof detalhe === "string"
            ? detalhe
            : detalhe?.mensagem || "Não foi possivel concluir o cadastro.",
        );
      }

      await signIn(dados.token, dados.usuario);

      if (dados.usuario.tipo_usuario === "paciente") {
        router.replace("/(paciente)/dashboard");
      } else {
        router.replace("/(nutricionista)/dashboard");
      }
    } catch (erro) {
      console.error("Erro ao escolher papel:", erro);
      Alert.alert(
        "Falha no cadastro",
        erro instanceof Error ? erro.message : "Ocorreu um erro ao cadastrar.",
      );
    } finally {
      setCarregando(false);
    }
  };
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Quase lá!</Text>
      <Text style={styles.subtitle}>
        para concluir seu cadastro com o Google, escolha como você vai usar o
        WishDiet.
      </Text>

      <View style={styles.containerPapeis}>
        <TouchableOpacity
          style={[
            styles.botaoPapel,
            tipoUsuario === "paciente" && styles.botaoPapelSelecionado,
          ]}
          onPress={() => setTipoUsuario("paciente")}
        >
          <Text style={styles.iconePapel}>👤</Text>
          <Text
            style={[
              styles.textoPapel,
              tipoUsuario === "paciente" && styles.textoPapelSelecionado,
            ]}
          >
            Paciente
          </Text>
          <Text style={styles.descricaoPapel}>Planos, exames e evolução</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.botaoPapel,
            tipoUsuario === "nutricionista" && styles.botaoPapelSelecionado,
          ]}
          onPress={() => setTipoUsuario("nutricionista")}
        >
          <Text style={styles.iconePapel}>🩺</Text>
          <Text
            style={[
              styles.textoPapel,
              tipoUsuario === "nutricionista" && styles.textoPapelSelecionado,
            ]}
          >
            nutricionista
          </Text>
          <Text style={styles.descricaoPapel}>pacientes, exames e planos</Text>
        </TouchableOpacity>
      </View>

      {tipoUsuario === "nutricionista" && (
        <View>
          <Text style={styles.label}>Número do CRN (Com região):</Text>
          <TextInput
            style={styles.input}
            placeholder="EX: CRN-3 12345/P"
            value={crn}
            onChangeText={setCrn}
          />
        </View>
      )}

      <TouchableOpacity
        style={styles.botaoPrincipal}
        onPress={handleConfirmar}
        disabled={carregando}
      >
        {carregando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.textoBotaoPrincipal}>Concluir cadastro</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.botaoCancelar}
        onPress={() => router.replace("/login")}
      >
        <Text style={styles.textoCancelar}>Cancelar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 6,
  },
  subtitle: { fontSize: 15, color: "#4B5563", marginBottom: 6 },
  containerPapeis: { flexDirection: "row", gap: 12, marginBottom: 20 },
  botaoPapel: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  botaoPapelSelecionado: { borderColor: "#2562EB", backgroundColor: "#EFF6FF" },
  iconePapel: { fontSize: 28, marginBottom: 6 },
  textoPapel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4B5563",
    marginBottom: 4,
  },
  textoPapelSelecionado: { color: "#2562EB" },
  descricaoPapel: { fontSize: 11, color: "#6B7280", textAlign: "center" },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#1F2937",
  },
  botaoPrincipal: {
    backgroundColor: "#2562EB",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 24,
  },
  textoBotaoPrincipal: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  botaoCancelar: { alignItems: "center", marginTop: 16 },
  textoCancelar: { fontSize: 14, color: "#6B7280", fontWeight: "600" },
});
