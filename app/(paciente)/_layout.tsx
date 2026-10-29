// ==============================================================================
// LAYOUT DE ABAS DO PACIENTE - WESHDIET
// ==============================================================================
// Navegação por abas inferiores exclusiva para o perfil de paciente.
// Exibe apenas as funcionalidades destinadas ao paciente.
// ==============================================================================

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function PacienteTabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      {/* ABA 1: DASHBOARD DO PACIENTE */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Início",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="home" size={28} color={color} />
          ),
        }}
      />

      {/* ABA 2: EXAMES LABORATORIAIS */}
      <Tabs.Screen
        name="exames"
        options={{
          title: "Exames",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="description" size={28} color={color} />
          ),
        }}
      />

      {/* ABA 3: PLANO ALIMENTAR */}
      <Tabs.Screen
        name="plano"
        options={{
          title: "Plano",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="restaurant" size={28} color={color} />
          ),
        }}
      />

      {/* ABA 4: EVOLUÇÃO NUTRICIONAL */}
      <Tabs.Screen
        name="evolucao"
        options={{
          title: "Evolução",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="trending-up" size={28} color={color} />
          ),
        }}
      />

      {/* ABA 5: MEU PERFIL */}
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="person" size={28} color={color} />
          ),
        }}
      />

      {/* TELAS ACESSÍVEIS POR NAVEGAÇÃO MAS NÃO VISÍVEIS COMO ABAS */}
      <Tabs.Screen name="check-ins" options={{ href: null }} />
      <Tabs.Screen name="relatorio" options={{ href: null }} />
      <Tabs.Screen name="analise-ia" options={{ href: null }} />
    </Tabs>
  );
}

