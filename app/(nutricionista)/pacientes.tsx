// ==============================================================================
// TELA DE GESTÃO DE PACIENTES DO NUTRICIONISTA - WESHDIET
// ==============================================================================
import { useRouter } from "expo-router";
import React from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function PacientesNutricionistaScreen() {
  const router = useRouter();

  // Lista simulada de pacientes vinculados para visualização profissional
  const pacientes = [
    { id: 1, nome: "Ana Clara Silva", objetivo: "Emagrecimento", status: "Ativo" },
    { id: 2, nome: "Carlos Eduardo Santos", objetivo: "Hipertrofia", status: "Ativo" },
    { id: 3, nome: "Mariana Costa", objetivo: "Controle de Glicemia", status: "Ativo" },
  ];

  return (
    <View style={styles.container}>
      {/* CABEÇALHO */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.botaoVoltar} onPress={() => router.back()}>
          <Text style={styles.textoVoltar}>⬅ Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Meus Pacientes</Text>
        <Text style={styles.subtitulo}>
          Gerencie os prontuários e acompanhamentos vinculados ao seu CRN.
        </Text>

        {/* BOTÃO PARA ADICIONAR NOVO PACIENTE */}
        <TouchableOpacity
          style={styles.botaoAdicionar}
          onPress={() => router.push("/(nutricionista)/adicionar-paciente")}
        >
          <Text style={styles.textoBotaoAdicionar}>➕ Cadastrar Novo Paciente</Text>
        </TouchableOpacity>
      </View>

      {/* LISTA DE PACIENTES */}
      <FlatList
        data={pacientes}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => (
          <Pressable
            style={styles.cardPaciente}
            onPress={() => router.push("/(nutricionista)/analise-ia")}
          >
            <View style={styles.avatar}>
              <Text style={styles.textoAvatar}>
                {item.nome.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.infoPaciente}>
              <Text style={styles.nomePaciente}>{item.nome}</Text>
              <Text style={styles.detalhesPaciente}>Objetivo: {item.objetivo}</Text>
            </View>
            <View style={styles.badgeStatus}>
              <Text style={styles.textoStatus}>{item.status}</Text>
            </View>
          </Pressable>
        )}
      />
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
  botaoAdicionar: {
    backgroundColor: "#059669",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  textoBotaoAdicionar: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 15,
  },
  lista: {
    padding: 16,
  },
  cardPaciente: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
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
    color: "#6B7280",
    marginTop: 2,
  },
  badgeStatus: {
    backgroundColor: "#DCFCE7",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  textoStatus: {
    fontSize: 11,
    color: "#166534",
    fontWeight: "600",
  },
});

