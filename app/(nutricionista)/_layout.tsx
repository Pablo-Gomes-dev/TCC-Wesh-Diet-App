// ==============================================================================
// LAYOUT DE ABAS DO NUTRICIONISTA - WESHDIET
// ==============================================================================
// Navegação por abas inferiores exclusiva para o perfil de nutricionista.
// Exibe apenas as funcionalidades destinadas ao profissional.
// ==============================================================================

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function NutricionistaTabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      {/* ABA 1: DASHBOARD DO NUTRICIONISTA */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Início",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="home" size={28} color={color} />
          ),
        }}
      />

      {/* ABA 2: LISTA DE PACIENTES VINCULADOS */}
      <Tabs.Screen
        name="pacientes"
        options={{
          title: "Pacientes",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="people" size={28} color={color} />
          ),
        }}
      />

      {/* ABA 3: EXAMES DOS PACIENTES */}
      <Tabs.Screen
        name="exames"
        options={{
          title: "Exames",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="description" size={28} color={color} />
          ),
        }}
      />

      {/* ABA 4: ANÁLISE POR INTELIGÊNCIA ARTIFICIAL */}
      <Tabs.Screen
        name="analise-ia"
        options={{
          title: "IA",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="psychology" size={28} color={color} />
          ),
        }}
      />

      {/* ABA 5: RELATÓRIOS */}
      <Tabs.Screen
        name="relatorio"
        options={{
          title: "Relatório",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="assignment" size={28} color={color} />
          ),
        }}
      />

      {/* TELAS ACESSÍVEIS POR NAVEGAÇÃO MAS NÃO VISÍVEIS COMO ABAS */}
      <Tabs.Screen name="plano" options={{ href: null }} />
      <Tabs.Screen name="evolucao" options={{ href: null }} />
      <Tabs.Screen name="adicionar-paciente" options={{ href: null }} />
    </Tabs>
  );
}

