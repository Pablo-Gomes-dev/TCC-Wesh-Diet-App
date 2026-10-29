// ==============================================================================
// TELA DE MENSAGENS (COMUNICAÇÃO NUTRICIONISTA & PACIENTE) - WESHDIET
// ==============================================================================
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function MensagensScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.botaoVoltar} onPress={() => router.back()}>
        <Text style={styles.textoVoltar}>⬅ Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Mensagens</Text>
      <Text style={styles.subtitle}>
        Canal seguro de comunicação direta entre paciente e nutricionista.
      </Text>
      <View style={styles.cardAviso}>
        <Text style={styles.textoAviso}>
          💬 O módulo de mensagens em tempo real está em fase de ativação e estará disponível nas próximas versões.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 50,
    backgroundColor: "#F5F7FA",
  },
  botaoVoltar: {
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  textoVoltar: {
    fontSize: 16,
    color: "#2562EB",
    fontWeight: "600",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    marginBottom: 24,
  },
  cardAviso: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  textoAviso: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 22,
  },
});
