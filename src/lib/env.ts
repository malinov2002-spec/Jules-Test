const required = (name: string, value: string | undefined): string => {
  if (!value || value.startsWith('YOUR') || value === 'sk-ant-...') {
    throw new Error(
      `Missing env var ${name}. Copy .env.example to .env and fill in real values.`,
    );
  }
  return value;
};

const optional = (value: string | undefined): string => value ?? '';

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  anthropicApiKey: required('EXPO_PUBLIC_ANTHROPIC_API_KEY', process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY),
  googleAndroidClientId: optional(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
  googleWebClientId: optional(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  userId: process.env.EXPO_PUBLIC_USER_ID ?? '11111111-1111-1111-1111-111111111111',
};

export const USER_ID = env.userId;
