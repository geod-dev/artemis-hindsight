import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// The session token is a secret and lives in the device keystore. Preferences live in AsyncStorage.
const TOKEN_KEY = "artemis.sessionToken";
const PREFERENCES_KEY = "artemis.preferences";

export function loadToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export type Appearance = "system" | "light" | "dark";
export type ReasoningEffort = "low" | "medium" | "high";

export interface Preferences {
  appearance: Appearance;
  reasoningEffort: ReasoningEffort;
  /** The drawer's Recents list shows the conversations of projects too (the web sidebar's sort menu). */
  showProjectConversations: boolean;
}

const DEFAULT_PREFERENCES: Preferences = { appearance: "system", reasoningEffort: "medium", showProjectConversations: true };

export async function loadPreferences(): Promise<Preferences> {
  const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(preferences: Preferences): Promise<void> {
  await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}
