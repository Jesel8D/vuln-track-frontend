import { analysisIntents } from "../analyses/intents";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthContext } from "./context";
import { SessionMemory } from "./session";
import { ApiClient } from "../../services/api";
import type { User } from "../../types/api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [memory] = useState(() => new SessionMemory());
  const [api] = useState(
    () =>
      new ApiClient(
        import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000",
        memory.getToken,
        memory.expire,
      ),
  );
  const clear = useCallback(
    (expired: boolean) => {
      memory.invalidate();
      analysisIntents.clear();
      api.abortAll();
      cache.clear();
      setUser(null);
      setExpiresAt(null);
      setNotice(
        expired
          ? "Tu sesión terminó. Inicia sesión de nuevo para continuar."
          : null,
      );
    },
    [api, cache, memory],
  );
  useEffect(() => {
    memory.onExpired(() => clear(true));
  }, [clear, memory]);
  useEffect(() => {
    if (!expiresAt) return;
    const check = () => {
      if (Date.now() >= expiresAt) clear(true);
    };
    const timer = window.setTimeout(check, Math.max(0, expiresAt - Date.now()));
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [expiresAt, clear]);
  useEffect(() => () => api.abortAll(), [api]);
  const login = async (username: string, password: string) => {
    const attempt = memory.begin();
    const result = await api.login(username, password);
    if (!memory.isCurrent(attempt)) return;
    if (
      result.token_type !== "bearer" ||
      !result.access_token ||
      !Number.isFinite(result.expires_in) ||
      result.expires_in <= 0 ||
      result.expires_in > 900
    ) {
      throw new Error("El servicio devolvió una sesión no válida.");
    }
    const receivedAt = Date.now();
    memory.setToken(result.access_token);
    try {
      const identity = await api.me();
      if (!memory.isCurrent(attempt)) return;
      if (
        typeof identity.id !== "string" ||
        typeof identity.username !== "string"
      )
        throw new Error("No pudimos verificar tu identidad.");
      cache.clear();
      setUser(identity);
      setNotice(null);
      setExpiresAt(receivedAt + result.expires_in * 1000);
    } catch (error) {
      if (memory.isCurrent(attempt)) clear(false);
      throw error;
    }
  };
  return (
    <AuthContext.Provider
      value={{ user, api, login, logout: () => clear(false), notice }}
    >
      {children}
    </AuthContext.Provider>
  );
}
