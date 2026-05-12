import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { env } from './env';

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = 'hermes.google.tokens';

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  // ms-since-epoch
  expiresAt: number;
}

export async function loadTokens(): Promise<GoogleTokens | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  return raw ? (JSON.parse(raw) as GoogleTokens) : null;
}

export async function saveTokens(t: GoogleTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(t));
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

const SCOPES = ['https://www.googleapis.com/auth/tasks'];

// Hook used by the Settings screen to kick off Google sign-in.
export function useGoogleAuth(onTokens: (t: GoogleTokens) => void) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: env.googleAndroidClientId || undefined,
    webClientId: env.googleWebClientId || undefined,
    scopes: SCOPES,
    // Required to get a refresh token from Google.
    extraParams: { access_type: 'offline', prompt: 'consent' },
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const auth = response.authentication;
      if (auth?.accessToken) {
        const tokens: GoogleTokens = {
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken ?? undefined,
          expiresAt: Date.now() + (auth.expiresIn ?? 3600) * 1000,
        };
        void saveTokens(tokens).then(() => onTokens(tokens));
      }
    }
  }, [response]);

  return { signIn: () => promptAsync(), ready: !!request };
}

// Refresh an access token using the stored refresh token. Google's token
// endpoint requires a client ID; we use the web client ID since refresh
// happens off the device-installed flow.
export async function refreshAccessToken(t: GoogleTokens): Promise<GoogleTokens> {
  if (!t.refreshToken) return t;
  const body = new URLSearchParams({
    client_id: env.googleWebClientId,
    grant_type: 'refresh_token',
    refresh_token: t.refreshToken,
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  const next: GoogleTokens = {
    accessToken: json.access_token,
    refreshToken: t.refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  await saveTokens(next);
  return next;
}

export async function getValidAccessToken(): Promise<string | null> {
  const t = await loadTokens();
  if (!t) return null;
  if (Date.now() < t.expiresAt - 60_000) return t.accessToken;
  try {
    const refreshed = await refreshAccessToken(t);
    return refreshed.accessToken;
  } catch {
    return null;
  }
}

// Re-export so callers don't need to import expo modules directly.
export { AuthSession };
