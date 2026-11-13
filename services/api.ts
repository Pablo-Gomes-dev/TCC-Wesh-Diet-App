// ==============================================================================
// CLIENTE HTTP CENTRALIZADO - WISHDIET
// ==============================================================================
// Único ponto de acesso à API: injeta o token, trata erros e normaliza "detail"
// (o backend ora envia texto, ora { codigo, mensagem }).
// Uso: const dados = await apiFetch<MeuTipo>("/paciente/meu-nutricionista");
// ==============================================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://10.0.0.23:8000";

export class ApiError extends Error {
  status: number;
  codigo?: string;

  constructor(status: number, mensagem: string, codigo?: string) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
    this.codigo = codigo;
  }
}

type Opcoes = Omit<RequestInit, "body"> & { body?: unknown };

let aoSessaoExpirar: (() => void) | null = null;

/** Opcional: registre uma função (ex.: signOut) chamada quando a API responder 401. */
export function definirAoSessaoExpirar(fn: (() => void) | null) {
  aoSessaoExpirar = fn;
}

export async function apiFetch<T = any>(
  caminho: string,
  { body, headers, ...resto }: Opcoes = {},
): Promise<T> {
  const token = await AsyncStorage.getItem("@wishdiet:token");

  let resposta: Response;
  try {
    resposta = await fetch(`${API_BASE_URL}${caminho}`, {
      ...resto,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar ao servidor.");
  }

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    if (resposta.status === 401 && aoSessaoExpirar) aoSessaoExpirar();
    const detalhe = dados?.detail;
    const mensagem =
      typeof detalhe === "string"
        ? detalhe
        : detalhe?.mensagem || "Não foi possível concluir a operação.";
    throw new ApiError(resposta.status, mensagem, detalhe?.codigo);
  }

  return dados as T;
}
