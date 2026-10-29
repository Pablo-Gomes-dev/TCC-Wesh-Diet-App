// ==============================================================================
// LAYOUT RAIZ DE NAVEGAÇÃO (STACK) - WESHDIET
// ==============================================================================
// Configura o AuthProvider, controle centralizado de acesso por perfil,
// tema visual (claro/escuro) e status bar do aplicativo.
// ==============================================================================

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import "react-native-reanimated";

function RootNavigation() {
  const { usuario, token, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // GUARDA DE ROTAS / AUTORIZAÇÃO POR PERFIL
  useEffect(() => {
    if (isLoading) return;

    const grupoAtual = segments[0] as string | undefined;
    const estaNasTelasAuth = grupoAtual === "login" || grupoAtual === "cadastro";

    // 1. USUÁRIO NÃO AUTENTICADO TENTANDO ACESSAR ÁREAS PRIVADAS
    if (!token || !usuario) {
      if (!estaNasTelasAuth && grupoAtual !== "(tabs)") {
        router.replace("/login");
      }
      return;
    }

    // 2. PACIENTE AUTENTICADO
    if (usuario.tipo_usuario === "paciente") {
      // Bloqueia acesso à área do nutricionista ou retorno ao login/cadastro
      if (estaNasTelasAuth || grupoAtual === "(nutricionista)" || grupoAtual === "(tabs)") {
        router.replace("/(paciente)/dashboard");
      }
      return;
    }

    // 3. NUTRICIONISTA AUTENTICADO
    if (usuario.tipo_usuario === "nutricionista") {
      // Bloqueia acesso à área do paciente ou retorno ao login/cadastro
      if (estaNasTelasAuth || grupoAtual === "(paciente)" || grupoAtual === "(tabs)") {
        router.replace("/(nutricionista)/dashboard");
      }
      return;
    }

    // 4. PERFIL DESCONHECIDO OU INVÁLIDO
    router.replace("/login");
  }, [usuario, token, isLoading, segments, router]);

  // ENQUANTO RESTAURA A SESSÃO, EXIBE INDICADOR PARA EVITAR FLASH DE TELA INCORRETA
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2562EB" />
      </View>
    );
  }

  return (
    <Stack>
      {/* GRUPO DE ABAS DO PACIENTE */}
      <Stack.Screen name="(paciente)" options={{ headerShown: false }} />

      {/* GRUPO DE ABAS DO NUTRICIONISTA */}
      <Stack.Screen name="(nutricionista)" options={{ headerShown: false }} />

      {/* ROTAS PÚBLICAS DE AUTENTICAÇÃO */}
      <Stack.Screen name="login" options={{ title: "Login", headerShown: false }} />
      <Stack.Screen name="cadastro" options={{ title: "Criar Conta" }} />

      {/* ROTAS COMPARTILHADAS / LEGADAS PRESERVADAS */}
      <Stack.Screen name="home" options={{ title: "Home" }} />
      <Stack.Screen name="Mensagens" options={{ title: "Mensagens" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <RootNavigation />
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
});
