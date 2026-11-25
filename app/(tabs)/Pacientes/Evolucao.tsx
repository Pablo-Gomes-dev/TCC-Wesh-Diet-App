import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "@/services/api";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

type Checkin = { id: number; data_checkin: string; peso_kg: number; adesao_percentual: number; classificacao?: string; analise?: { resumo?: string } | null };

export default function EvolucaoScreen() {
  const [peso, setPeso] = useState(""); const [cintura, setCintura] = useState(""); const [quadril, setQuadril] = useState("");
  const [adesao, setAdesao] = useState(""); const [energia, setEnergia] = useState(""); const [sono, setSono] = useState("");
  const [dificuldades, setDificuldades] = useState(""); const [observacoes, setObservacoes] = useState("");
  const [historico, setHistorico] = useState<Checkin[]>([]); const [carregando, setCarregando] = useState(true); const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const local = await AsyncStorage.getItem("paciente");
      if (local) await apiFetch("/paciente/perfil-inicial", { method: "PUT", body: JSON.parse(local) });
      const resposta = await apiFetch<{ checkins: Checkin[] }>("/paciente/evolucao"); setHistorico(resposta.checkins || []);
    } catch { Alert.alert("Evolução", "Não foi possível carregar seu histórico."); } finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const enviar = async () => {
    const pesoNumero = Number(peso.replace(",", ".")); const adesaoNumero = Number(adesao);
    if (!pesoNumero || !adesao || adesaoNumero < 0 || adesaoNumero > 100) { Alert.alert("Dados obrigatórios", "Informe peso e adesão entre 0 e 100%."); return; }
    try {
      setEnviando(true);
      const resposta = await apiFetch<{ analise: { resumo?: string }; modelo: string }>("/paciente/evolucao/checkins", { method: "POST", body: {
        peso_kg: pesoNumero, cintura_cm: cintura ? Number(cintura.replace(",", ".")) : null, quadril_cm: quadril ? Number(quadril.replace(",", ".")) : null,
        adesao_percentual: adesaoNumero, energia: energia ? Number(energia) : null, sono: sono ? Number(sono) : null,
        dificuldades: dificuldades.trim() || null, observacoes: observacoes.trim() || null,
      } });
      setPeso(""); setCintura(""); setQuadril(""); setAdesao(""); setEnergia(""); setSono(""); setDificuldades(""); setObservacoes(""); await carregar();
      Alert.alert("Análise concluída", `${resposta.analise?.resumo || "Sua evolução foi registrada."}${resposta.modelo === "regra-local" ? "\n\nAnálise realizada pelo plano local." : ""}`);
    } catch (erro: any) { Alert.alert("Erro", erro?.message || "Não foi possível registrar o questionário."); } finally { setEnviando(false); }
  };

  return <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} />}>
    <Text style={styles.title}>Minha evolução</Text><Text style={styles.subtitle}>Responda para comparar seu momento atual com o perfil inicial ou com seu último registro.</Text>
    <Text style={styles.section}>Questionário</Text>
    <Campo label="Peso atual (kg) *" value={peso} onChange={setPeso} teclado="decimal-pad" /><Campo label="Cintura (cm)" value={cintura} onChange={setCintura} teclado="decimal-pad" /><Campo label="Quadril (cm)" value={quadril} onChange={setQuadril} teclado="decimal-pad" /><Campo label="Adesão ao plano (%) *" value={adesao} onChange={setAdesao} teclado="numeric" /><Campo label="Energia (0 a 10)" value={energia} onChange={setEnergia} teclado="numeric" /><Campo label="Sono (0 a 10)" value={sono} onChange={setSono} teclado="numeric" /><Campo label="Dificuldades" value={dificuldades} onChange={setDificuldades} multiline /><Campo label="Observações" value={observacoes} onChange={setObservacoes} multiline />
    <Pressable style={styles.button} onPress={enviar} disabled={enviando}>{enviando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Enviar e analisar</Text>}</Pressable>
    <Text style={styles.section}>Histórico</Text>{!carregando && historico.length === 0 ? <Text style={styles.empty}>Nenhum questionário respondido ainda.</Text> : historico.map((item) => <View style={styles.card} key={item.id}><Text style={styles.cardTitle}>{item.data_checkin} — {item.classificacao || "Processando"}</Text><Text style={styles.cardDetail}>Peso: {item.peso_kg} kg · Adesão: {item.adesao_percentual}%</Text>{item.analise?.resumo ? <Text style={styles.summary}>{item.analise.resumo}</Text> : null}</View>)}
  </ScrollView>;
}

function Campo({ label, value, onChange, teclado, multiline = false }: { label: string; value: string; onChange: (value: string) => void; teclado?: "numeric" | "decimal-pad"; multiline?: boolean }) { return <View><Text style={styles.label}>{label}</Text><TextInput style={[styles.input, multiline && styles.textArea]} value={value} onChangeText={onChange} keyboardType={teclado} multiline={multiline} /></View>; }

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: "#F5F7FA" }, content: { padding: 20, paddingTop: 50, paddingBottom: 40 }, title: { fontSize: 28, fontWeight: "800", color: "#1F2937" }, subtitle: { color: "#6B7280", lineHeight: 20, marginTop: 8, marginBottom: 20 }, section: { fontSize: 20, fontWeight: "700", color: "#1F2937", marginTop: 12, marginBottom: 10 }, label: { color: "#374151", fontWeight: "600", marginTop: 10, marginBottom: 6 }, input: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, padding: 12, color: "#111827" }, textArea: { minHeight: 80, textAlignVertical: "top" }, button: { backgroundColor: "#2562EB", borderRadius: 9, alignItems: "center", padding: 14, marginTop: 20 }, buttonText: { color: "#FFF", fontWeight: "700" }, empty: { color: "#6B7280" }, card: { backgroundColor: "#FFF", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB" }, cardTitle: { fontWeight: "700", color: "#1F2937" }, cardDetail: { color: "#6B7280", marginTop: 6 }, summary: { color: "#374151", marginTop: 10, lineHeight: 19 } });
