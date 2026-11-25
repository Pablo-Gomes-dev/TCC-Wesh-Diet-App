import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/services/api";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

type Cadastro = { id: number; nome: string; email: string; crn?: string; criado_em?: string };

export default function AdminScreen() {
  const router = useRouter();
  const { usuario, signOut } = useAuth();
  const [itens, setItens] = useState<Cadastro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setCarregando(true);
      const resposta = await apiFetch<{ nutricionistas: Cadastro[] }>("/admin/nutricionistas-pendentes");
      setItens(resposta.nutricionistas || []);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar os cadastros pendentes.");
    } finally { setCarregando(false); setRefreshing(false); }
  }, []);

  useEffect(() => { if (usuario?.is_admin) carregar(); }, [carregar, usuario?.is_admin]);

  function decidir(item: Cadastro, status: "aprovado" | "rejeitado") {
    const acao = status === "aprovado" ? "Aprovar" : "Rejeitar";
    Alert.alert(`${acao} cadastro`, `${item.nome}\nCRN: ${item.crn || "não informado"}`, [
      { text: "Cancelar", style: "cancel" },
      { text: acao, onPress: async () => {
        try {
          await apiFetch(`/admin/nutricionistas/${item.id}/status`, { method: "PATCH", body: { status_aprovacao: status } });
          setItens((lista) => lista.filter((x) => x.id !== item.id));
          Alert.alert("Concluído", `Cadastro ${status} com sucesso.`);
        } catch { Alert.alert("Erro", "Não foi possível atualizar o cadastro."); }
      } },
    ]);
  }

  return <View style={styles.container}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>ADMINISTRAÇÃO</Text><Text style={styles.title}>Cadastros pendentes</Text></View>
      <Pressable onPress={() => signOut().then(() => router.replace("/login"))}><Text style={styles.logout}>Sair</Text></Pressable>
    </View>
    {carregando ? <ActivityIndicator size="large" color="#2562EB" /> : <FlatList
      data={itens} keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} />}
      ListEmptyComponent={<Text style={styles.empty}>Nenhum cadastro pendente.</Text>}
      renderItem={({ item }) => <View style={styles.card}><Text style={styles.name}>{item.nome}</Text><Text style={styles.detail}>{item.email}</Text><Text style={styles.detail}>CRN: {item.crn || "não informado"}</Text>
        <View style={styles.actions}><Pressable style={[styles.button, styles.reject]} onPress={() => decidir(item, "rejeitado")}><Text style={styles.rejectText}>Rejeitar</Text></Pressable><Pressable style={[styles.button, styles.approve]} onPress={() => decidir(item, "aprovado")}><Text style={styles.approveText}>Aprovar</Text></Pressable></View>
      </View>}
    />}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA", padding: 20, paddingTop: 58 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  eyebrow: { color: "#2562EB", fontSize: 12, fontWeight: "700" }, title: { color: "#1F2937", fontSize: 26, fontWeight: "800", marginTop: 4 }, logout: { color: "#DC2626", fontWeight: "700" },
  empty: { textAlign: "center", color: "#6B7280", marginTop: 40 }, card: { backgroundColor: "#FFF", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" }, name: { color: "#111827", fontSize: 17, fontWeight: "700" }, detail: { color: "#6B7280", marginTop: 5 }, actions: { flexDirection: "row", gap: 10, marginTop: 16 }, button: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 9 }, reject: { backgroundColor: "#FEF2F2" }, approve: { backgroundColor: "#DCFCE7" }, rejectText: { color: "#B91C1C", fontWeight: "700" }, approveText: { color: "#15803D", fontWeight: "700" },
});
