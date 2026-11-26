// ==============================================================================
// CONTEXTO CENTRALIZADO DE AUTENTICAÇÃO E SESSÃO - WISHDIET
// ==============================================================================
// Gerencia o estado de autenticação de forma centralizada:
// - Restauração automática da sessão ao iniciar o aplicativo
// - Validação do token com o backend (/auth/me)
// - Funções signIn e signOut acessíveis em todo o aplicativo
// - Atualiza o perfil local com os dados mais recentes do backend
// - Encerra a sessão automaticamente quando a API responde 401
// ==============================================================================

import { API_BASE_URL, definirAoSessaoExpirar } from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";

const AUTH_VALIDATION_TIMEOUT_MS = 8000;

// TIPOS
export type Usuario = {
  id: number;
  nome: string;
  email: string;
  tipo_usuario: "paciente" | "nutricionista";
  status_aprovacao?: string;
  crn?: string;
  ativo?: boolean;
  is_admin?: boolean;
  codigo_vinculo?: string;
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

  // LIMPA A SESSÃO LOCAL (TOKEN, PERFIL E ESTADO)
  const limparSessaoLocal = useCallback(async () => {
    await AsyncStorage.removeItem("@wishdiet:token");
    await AsyncStorage.removeItem("@wishdiet:usuario");
    setToken(null);
    setUsuario(null);
  }, []);

  // RESTAURAÇÃO AUTOMÁTICA DA SESSÃO AO MONTAR
  useEffect(() => {
    const restaurarSessao = async () => {
      try {
        const tokenSalvo = await AsyncStorage.getItem("@wishdiet:token");
        const usuarioSalvo = await AsyncStorage.getItem("@wishdiet:usuario");

        if (tokenSalvo && usuarioSalvo) {
          const usuarioLocal = JSON.parse(usuarioSalvo) as Usuario;
          setToken(tokenSalvo);
          setUsuario(usuarioLocal);
          // VALIDA O TOKEN COM O BACKEND (FONTE CONFIÁVEL DE AUTORIZAÇÃO)
          const controlador = new AbortController();
          const temporizador = setTimeout(() => controlador.abort(), AUTH_VALIDATION_TIMEOUT_MS);
          let resposta: Response;
          try {
            resposta = await fetch(`${API_BASE_URL}/auth/me`, {
              headers: { Authorization: `Bearer ${tokenSalvo}` },
              signal: controlador.signal,
            });
          } finally {
            clearTimeout(temporizador);
          }

          if (resposta.ok) {
            const dados = await resposta.json();
            const usuarioBackend = dados.usuario;

            // Atualiza os dados locais com os do backend (tipo_usuario confiável)
            setToken(tokenSalvo);
            setUsuario(usuarioBackend);
            await AsyncStorage.setItem(
              "@wishdiet:usuario",
              JSON.stringify(usuarioBackend),
            );
          } else {
            // Token inválido ou expirado — limpa sessão
            await limparSessaoLocal();
          }
        }
      } catch {
        // Sem conexão ou erro inesperado — limpa sessão por segurança
        // A sessão local permanece disponível quando a falha é de rede ou timeout.
      } finally {
        setIsLoading(false);
      }
    };

    restaurarSessao();
  }, [limparSessaoLocal]);

  // QUANDO QUALQUER CHAMADA VIA apiFetch RECEBER 401, ENCERRA A SESSÃO.
  // O GUARDA DE ROTAS DO _layout.tsx REDIRECIONA PARA O LOGIN AUTOMATICAMENTE.
  useEffect(() => {
    definirAoSessaoExpirar(() => {
      limparSessaoLocal();
    });
    return () => definirAoSessaoExpirar(null);
  }, [limparSessaoLocal]);

  // LOGIN: PERSISTE SESSÃO E ATUALIZA ESTADO
  const signIn = useCallback(
    async (novoToken: string, novoUsuario: Usuario) => {
      await AsyncStorage.setItem("@wishdiet:token", novoToken);
      await AsyncStorage.setItem(
        "@wishdiet:usuario",
        JSON.stringify(novoUsuario),
      );
      setToken(novoToken);
      setUsuario(novoUsuario);
    },
    [],
  );

  // LOGOUT: REMOVE SESSÃO E LIMPA ESTADO
  const signOut = useCallback(async () => {
    await limparSessaoLocal();
  }, [limparSessaoLocal]);

  return (
    <AuthContext.Provider
      value={{ usuario, token, isLoading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// HOOK PARA ACESSAR O CONTEXTO DE AUTENTICAÇÃO
export const useAuth = () => useContext(AuthContext);
