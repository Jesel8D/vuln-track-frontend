import { createContext, useContext } from "react";
import type { ApiClient } from "../../services/api";
import type { User } from "../../types/api";
export interface AuthValue {
  user: User | null;
  api: ApiClient;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  notice: string | null;
}
export const AuthContext = createContext<AuthValue | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider requerido");
  return value;
}
