// ==============================================================================
// CONSENTIMENTO PARA USO DE IA (LGPD) - WISHDIET
// ==============================================================================
// Exiba para o PACIENTE (ex.: no dashboard) quando concedido === false.
//   const { concedido, carregando, registrar } = useConsentimentoIA();
//   <ConsentimentoIAModal visivel={concedido === false} ... />
// ==============================================================================

import { apiFetch } from "@/services/api";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type EstadoConsentimento = {
  concedido: boolean;
  texto: string;
  versao_texto: string;
};

export function useConsentimentoIA() {
  const [estado, setEstado] = useState<EstadoConsentimento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setEstado(await apiFetch<EstadoConsentimento>("/consentimento/ia"));
    } catch {
      setEstado(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const registrar = async (concedido: boolean) => {
    setEnviando(true);
    try {
      await apiFetch("/consentimento/ia", {
        method: "POST",
        body: { concedido },
      });
      await carregar();
    } finally {
      setEnviando(false);
    }
  };

  return {
    concedido: estado ? estado.concedido : null, // null = ainda desconhecido
    texto: estado?.texto ?? "",
    carregando,
    enviando,
    registrar,
  };
}

type Props = {
  visivel: boolean;
  texto: string;
  enviando: boolean;
  aoAceitar: () => void;
  aoRecusar: () => void;
};

export function ConsentimentoIAModal({
  visivel,
  texto,
  enviando,
  aoAceitar,
  aoRecusar,
}: Props) {
  return (
    <Modal visible={visivel} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.caixa}>
          <Text style={styles.titulo}>Uso de inteligência artificial</Text>
          <ScrollView style={styles.corpo}>
            <Text style={styles.texto}>{texto}</Text>
          </ScrollView>
          <View style={styles.botoes}>
            <TouchableOpacity
              style={styles.botaoRecusar}
              onPress={aoRecusar}
              disabled={enviando}
            >
              <Text style={styles.textoRecusar}>Não autorizo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.botaoAceitar}
              onPress={aoAceitar}
              disabled={enviando}
            >
              {enviando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.textoAceitar}>Autorizo</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  caixa: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    maxHeight: "85%",
  },
  titulo: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 12,
  },
  corpo: { marginBottom: 16 },
  texto: { fontSize: 14, color: "#4B5563", lineHeight: 21 },
  botoes: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  botaoRecusar: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  textoRecusar: { fontSize: 14, color: "#4B5563", fontWeight: "600" },
  botaoAceitar: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#2562EB",
  },
  textoAceitar: { fontSize: 14, color: "#FFFFFF", fontWeight: "bold" },
});
