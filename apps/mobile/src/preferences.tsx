import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { darkTokens, lightTokens, type ThemeToken } from "@/theme/tokens";
import { loadPreferences, savePreferences, type Appearance, type Preferences, type ReasoningEffort } from "@/lib/storage";

// The colours come from the web theme's tokens (src/theme/tokens.ts, generated from services/web/src/app/globals.css).
// The names below are the app's roles; each one reads the web token it corresponds to.
export interface Palette {
  background: string;
  surface: string;
  surfaceStrong: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  danger: string;
  /** The user's message bubble: the web's primary colour, with its foreground on top. */
  user: string;
  onUser: string;
}

function paletteOf(tokens: Record<ThemeToken, string>): Palette {
  return {
    background: tokens.background,
    surface: tokens.card,
    surfaceStrong: tokens.secondary,
    border: tokens.border,
    text: tokens.foreground,
    muted: tokens["muted-foreground"],
    accent: tokens.primary,
    accentText: tokens["primary-foreground"],
    danger: tokens.destructive,
    user: tokens.primary,
    onUser: tokens["primary-foreground"],
  };
}

export const palettes: Record<"light" | "dark", Palette> = {
  light: paletteOf(lightTokens),
  dark: paletteOf({ ...lightTokens, ...darkTokens }),
};

interface PreferencesValue {
  preferences: Preferences;
  colors: Palette;
  isDark: boolean;
  setAppearance: (appearance: Appearance) => void;
  setReasoningEffort: (effort: ReasoningEffort) => void;
  setShowProjectConversations: (show: boolean) => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>({
    appearance: "system",
    reasoningEffort: "medium",
    showProjectConversations: true,
  });
  const systemScheme = useColorScheme();

  useEffect(() => {
    void loadPreferences().then(setPreferences);
  }, []);

  const update = useCallback(
    (patch: Partial<Preferences>) => {
      const next = { ...preferences, ...patch };
      setPreferences(next);
      void savePreferences(next);
    },
    [preferences],
  );

  const isDark = preferences.appearance === "dark" || (preferences.appearance === "system" && systemScheme === "dark");

  const value = useMemo<PreferencesValue>(
    () => ({
      preferences,
      colors: isDark ? palettes.dark : palettes.light,
      isDark,
      setAppearance: (appearance) => update({ appearance }),
      setReasoningEffort: (reasoningEffort) => update({ reasoningEffort }),
      setShowProjectConversations: (showProjectConversations) => update({ showProjectConversations }),
    }),
    [preferences, isDark, update],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}
