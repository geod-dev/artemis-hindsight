import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, apiFetch, onUnauthorized, setClientSession } from "@/lib/api";
import { SERVER_URL } from "@/lib/config";
import { clearToken, loadToken, saveToken } from "@/lib/storage";

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarColor: string | null;
  profileComplete: boolean;
}

type AuthState =
  | { status: "loading" }
  | { status: "signedOut"; serverUrl: string }
  | { status: "signedIn"; serverUrl: string; user: CurrentUser }
  | { status: "unreachable"; serverUrl: string; message: string };

interface AuthContextValue {
  state: AuthState;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  const signedOut = useCallback(async (serverUrl: string) => {
    await clearToken();
    setClientSession({ serverUrl, token: null });
    setState({ status: "signedOut", serverUrl });
  }, []);

  // Start-up: restore the server and token, then ask the server who we are. A rejected token signs out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await loadToken();
      if (!token) {
        if (!cancelled) await signedOut(SERVER_URL);
        return;
      }
      setClientSession({ serverUrl: SERVER_URL, token });
      try {
        const user = await apiFetch<CurrentUser>("/api/me");
        if (!cancelled) setState({ status: "signedIn", serverUrl: SERVER_URL, user });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) await signedOut(SERVER_URL);
        else setState({ status: "unreachable", serverUrl: SERVER_URL, message: error instanceof Error ? error.message : "unknown error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, signedOut]);

  // The API client reports a rejected token outside React, so it reads the current state through a ref.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    onUnauthorized(() => {
      const current = stateRef.current;
      if (current.status === "signedIn" || current.status === "unreachable") void signedOut(current.serverUrl);
    });
  }, [signedOut]);

  const signIn = useCallback(async (username: string, password: string) => {
    setClientSession({ serverUrl: SERVER_URL, token: null });
    const { token } = await apiFetch<{ token?: string }>("/api/auth/login", {
      method: "POST",
      json: { username: username.trim(), password },
    });
    // An older server answers without a token: the app cannot work with it until the server is updated.
    if (!token) throw new Error("The server did not return a session. Its version is probably outdated.");
    await saveToken(token);
    setClientSession({ serverUrl: SERVER_URL, token });
    const user = await apiFetch<CurrentUser>("/api/me");
    setState({ status: "signedIn", serverUrl: SERVER_URL, user });
  }, []);

  const signOut = useCallback(async () => {
    // The token is a stateless JWT: the server cannot revoke it, so signing out only forgets it on this device.
    await signedOut(SERVER_URL);
  }, [signedOut]);

  const refreshUser = useCallback(async () => {
    if (state.status !== "signedIn") return;
    const user = await apiFetch<CurrentUser>("/api/me");
    setState({ status: "signedIn", serverUrl: state.serverUrl, user });
  }, [state]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo(() => ({ state, signIn, signOut, refreshUser, retry }), [state, signIn, signOut, refreshUser, retry]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
