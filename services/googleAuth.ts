import type { Usuario } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/services/api";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

let configurado = false;
function configurar() {
  if (configurado) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    scopes: ["email", "profile"],
  });
  configurado = true;
}

export type ResultadoGoogle =
  | { status: "ok"; token: string; usuario: Usuario }
  | { status: "escolher_papel"; idToken: string }
  | { status: "cancelado" };

export async function entrarComGoogle(): Promise<ResultadoGoogle> {
  configurar();
  await GoogleSignin.hasPlayServices();
  const resp = await GoogleSignin.signIn();
  if (resp.type !== "success") return { status: "cancelado" };
  const idToken = resp.data.idToken;
  if (!idToken) throw new Error("Não foi possível obter o token do Google.");

  const r = await fetch(`${API_BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  const dados = await r.json().catch(() => ({}));
  const detalhe = dados?.detail;

  if (
    r.status === 400 &&
    typeof detalhe === "object" &&
    detalhe?.codigo === "PAPEL_OBRIGATORIO"
  ) {
    return { status: "escolher_papel", idToken };
  }
  if (!r.ok) {
    throw new Error(
      typeof detalhe === "string"
        ? detalhe
        : detalhe?.mensagem || "Falha ao autenticar com o Google.",
    );
  }
  return { status: "ok", token: dados.token, usuario: dados.usuario };
}

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  scopes: ["email", "profile"],
});

export async function obterIdTokenGoogle(): Promise<string> {
  await GoogleSignin.hasPlayServices();
  const resp = await GoogleSignin.signIn();
  const idToken = resp.data?.idToken;
  if (!idToken) throw new Error("Não foi possivel obter o token do Google.");
  return idToken;
}
