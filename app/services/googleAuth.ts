import { GoogleSignin } from "@react-native-google-signin/google-signin";

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
