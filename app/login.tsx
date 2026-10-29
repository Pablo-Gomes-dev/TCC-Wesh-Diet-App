// ==============================================================================
// TELA DE AUTENTICAÇÃO (LOGIN) - WESHDIET
// ==============================================================================
// Esta tela autentica o usuário no backend FastAPI com e-mail e senha ou Google.
// Ao autenticar com sucesso, recupera o papel ('paciente' ou 'nutricionista')
// do banco de dados e direciona o usuário para sua respectiva área de trabalho.
// ==============================================================================

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// CONFIGURAÇÃO DA URL BASE DA API DO BACKEND
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.0.0.23:8000";

export default function LoginScreen() {
  const router = useRouter();
  const { usuario, token, signIn, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [carregando, setCarregando] = useState(false);

  // SE JÁ HOUVER SESSÃO VÁLIDA RESTAURADA PELO CONTEXTO, DIRECIONA IMEDIATAMENTE
  useEffect(() => {
    if (!isLoading && token && usuario) {
      if (usuario.tipo_usuario === "paciente") {
        router.replace("/(paciente)/dashboard");
      } else if (usuario.tipo_usuario === "nutricionista") {
        router.replace("/(nutricionista)/dashboard");
      }
    }
  }, [isLoading, token, usuario, router]);

  // FUNÇÃO DE LOGIN COM E-MAIL E SENHA
  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert("Campo obrigatório", "Digite seu e-mail.");
      return;
    }
    if (!password) {
      Alert.alert("Campo obrigatório", "Digite sua senha.");
      return;
    }

    try {
      setCarregando(true);

      const resposta = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          senha: password,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.detail || "Falha ao realizar login.");
      }

      // ATUALIZA A SESSÃO NO CONTEXTO E PERSISTE O TOKEN
      await signIn(dados.token, dados.usuario);

      // DIRECIONAMENTO CONFORME O PAPEL
      if (dados.usuario.tipo_usuario === "paciente") {
        router.replace("/(paciente)/dashboard");
      } else if (dados.usuario.tipo_usuario === "nutricionista") {
        router.replace("/(nutricionista)/dashboard");
      } else {
        router.replace("/login");
      }
    } catch (erro) {
      console.error("Erro no login:", erro);
      Alert.alert(
        "Erro de Autenticação",
        erro instanceof Error ? erro.message : "Não foi possível conectar ao servidor."
      );
    } finally {
      setCarregando(false);
    }
  };

  // AUTENTICAÇÃO COM GOOGLE (OPCIONAL)
  const handleGoogleLogin = () => {
    Alert.alert(
      "Entrar com Google",
      "O login com Google está integrado como opção adicional. Em ambiente de homologação, utilize o formulário tradicional ou selecione as credenciais configuradas."
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WeshDiet</Text>
      <Text style={styles.subtitle}>Entre na sua conta para continuar</Text>

      {/* FORMULÁRIO DE LOGIN */}
      <View style={styles.form}>
        <Text style={styles.label}>E-mail:</Text>
        <TextInput
          style={styles.input}
          placeholder="seu.email@exemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Senha:</Text>
        <TextInput
          style={styles.input}
          placeholder="Digite sua senha"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {/* BOTÃO DE ENTRAR */}
        <TouchableOpacity
          style={styles.botaoEntrar}
          onPress={handleLogin}
          disabled={carregando}
        >
          {carregando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.textoBotaoEntrar}>Entrar</Text>
          )}
        </TouchableOpacity>

        {/* DIVISOR */}
        <View style={styles.divisorContainer}>
          <View style={styles.linhaDivisoria} />
          <Text style={styles.textoDivisor}>ou</Text>
          <View style={styles.linhaDivisoria} />
        </View>

        {/* BOTÃO GOOGLE */}
        <TouchableOpacity style={styles.botaoGoogle} onPress={handleGoogleLogin}>
          <Text style={styles.textoGoogle}>Entrar com Google</Text>
        </TouchableOpacity>

        {/* LINK PARA CRIAR CONTA */}
        <View style={styles.containerCadastro}>
          <Text style={styles.textoSemConta}>Não tem uma conta?</Text>
          <TouchableOpacity onPress={() => router.push("/cadastro")}>
            <Text style={styles.linkCadastrar}> Cadastre-se</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ------------------------------------------------------------------------------
// ESTILOS VISUAIS DA TELA DE LOGIN
// ------------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#F5F7FA",
    padding: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#1F2937",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 6,
    marginBottom: 30,
    textAlign: "center",
  },
  form: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#1F2937",
  },
  botaoEntrar: {
    backgroundColor: "#2562EB",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  textoBotaoEntrar: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  divisorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
  },
  linhaDivisoria: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  textoDivisor: {
    marginHorizontal: 10,
    fontSize: 13,
    color: "#9CA3AF",
  },
  botaoGoogle: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  textoGoogle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  containerCadastro: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  textoSemConta: {
    fontSize: 14,
    color: "#4B5563",
  },
  linkCadastrar: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2562EB",
  },
});
