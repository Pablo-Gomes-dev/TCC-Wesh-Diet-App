// ==============================================================================
// CONTEXTO CENTRALIZADO DE AUTENTICAÇÃO E SESSÃO - WESHDIET
// ==============================================================================
// Gerencia o estado de autenticação de forma centralizada:
// - Restauração automática da sessão ao iniciar o aplicativo
// - Validação do token com o backend (/auth/me)
// - Funções signIn e signOut acessíveis em todo o aplicativo
// - Atualiza o perfil local com os dados mais recentes do backend
// ==============================================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.0.0.23:8000";

// TIPOS
export type Usuario = {
  id: number;
  nome: string;
  email: string;
  tipo_usuario: "paciente" | "nutricionista";
  status_aprovacao?: string;
  crn?: string;
  ativo?: boolean;
};

type AuthContextType = {
  usuario: Usuario | null;
  token: string | null;
  isLoading: boolean;
  signIn: (token: string, usuario: Usuario) => Promise<void>;
  signOut: () => Promise<void>;
};

// CONTEXTO COM VALORES PADRÃO
const AuthContext = createContext<AuthContextType>({
  usuario: null,
  token: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});

// PROVIDER PRINCIPAL DE AUTENTICAÇÃO
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // RESTAURAÇÃO AUTOMÁTICA DA SESSÃO AO MONTAR
  useEffect(() => {
    restaurarSessao();
  }, []);

  const restaurarSessao = async () => {
    try {
      const tokenSalvo = await AsyncStorage.getItem("@weshdiet:token");
      const usuarioSalvo = await AsyncStorage.getItem("@weshdiet:usuario");

      if (tokenSalvo && usuarioSalvo) {
        // VALIDA O TOKEN COM O BACKEND (FONTE CONFIÁVEL DE AUTORIZAÇÃO)
        const resposta = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${tokenSalvo}` },
        });

        if (resposta.ok) {
          const dados = await resposta.json();
          const usuarioBackend = dados.usuario;

          // Atualiza os dados locais com os do backend (tipo_usuario confiável)
          setToken(tokenSalvo);
          setUsuario(usuarioBackend);
          await AsyncStorage.setItem(
            "@weshdiet:usuario",
            JSON.stringify(usuarioBackend)
          );
        } else {
          // Token inválido ou expirado — limpa sessão
          await limparSessaoLocal();
        }
      }
    } catch {
      // Sem conexão ou erro inesperado — limpa sessão por segurança
      await limparSessaoLocal();
    } finally {
      setIsLoading(false);
    }
  };

  const limparSessaoLocal = async () => {
    await AsyncStorage.removeItem("@weshdiet:token");
    await AsyncStorage.removeItem("@weshdiet:usuario");
    setToken(null);
    setUsuario(null);
  };

  // LOGIN: PERSISTE SESSÃO E ATUALIZA ESTADO
  const signIn = useCallback(async (novoToken: string, novoUsuario: Usuario) => {
    await AsyncStorage.setItem("@weshdiet:token", novoToken);
    await AsyncStorage.setItem("@weshdiet:usuario", JSON.stringify(novoUsuario));
    setToken(novoToken);
    setUsuario(novoUsuario);
  }, []);

  // LOGOUT: REMOVE SESSÃO E LIMPA ESTADO
  const signOut = useCallback(async () => {
    await limparSessaoLocal();
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, token, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// HOOK PARA ACESSAR O CONTEXTO DE AUTENTICAÇÃO
export const useAuth = () => useContext(AuthContext);

