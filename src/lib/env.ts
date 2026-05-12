const required = (name: string, value: string | undefined): string => {
  if (!value || value.startsWith('YOUR') || value === 'sk-ant-...') {
    throw new Error(
      `Missing env var ${name}. Copy .env.example to .env and fill in real values.`,
    );
  }
  return value;
};

const optional = (value: string | undefined): string => value ?? '';

const gatewayUrl = optional(process.env.EXPO_PUBLIC_GATEWAY_URL);
const gatewayToken = optional(process.env.EXPO_PUBLIC_GATEWAY_TOKEN);
const useGateway = gatewayUrl.length > 0 && gatewayToken.length > 0;

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  // When using the VPS gateway, the device doesn't need an Anthropic key — the
  // VPS holds it. Direct-mode (no gateway) still requires the key on device.
  anthropicApiKey: useGateway
    ? optional(process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY)
    : required('EXPO_PUBLIC_ANTHROPIC_API_KEY', process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY),
  gatewayUrl,
  gatewayToken,
  useGateway,
  googleAndroidClientId: optional(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
  googleWebClientId: optional(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  userId: process.env.EXPO_PUBLIC_USER_ID ?? '11111111-1111-1111-1111-111111111111',
};

export const USER_ID = env.userId;
