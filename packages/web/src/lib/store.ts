import { create } from "zustand";
import { api } from "@/lib/api";

interface User {
  id: number;
  email: string;
  name: string;
  defaultCurrency: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, defaultCurrency?: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

const STORAGE_KEY = "centsible-auth";

function saveToStorage(user: User, tokens: { accessToken: string; refreshToken: string }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, tokens }));
}

function loadFromStorage(): { user: User; tokens: { accessToken: string; refreshToken: string } } | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function clearStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export const useAuthStore = create<AuthState>((set) => {
  // Set up token refresh callback
  api.onRefresh((tokens) => {
    const stored = loadFromStorage();
    if (stored) {
      saveToStorage(stored.user, tokens);
    }
  });

  api.onAuthError(() => {
    clearStorage();
    api.clearTokens();
    set({ user: null, isAuthenticated: false });
  });

  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,

    login: async (email: string, password: string) => {
      const result = await api.login({ email, password });
      const { user, tokens } = result.data;
      api.setTokens(tokens.accessToken, tokens.refreshToken);
      saveToStorage(user, tokens);
      set({ user, isAuthenticated: true });
    },

    register: async (email: string, password: string, name: string, defaultCurrency?: string) => {
      const result = await api.register({ email, password, name, defaultCurrency });
      const { user, tokens } = result.data;
      api.setTokens(tokens.accessToken, tokens.refreshToken);
      saveToStorage(user, tokens);
      set({ user, isAuthenticated: true });
    },

    logout: () => {
      api.logout().catch(() => {});
      api.clearTokens();
      clearStorage();
      set({ user: null, isAuthenticated: false });
    },

    hydrate: () => {
      const stored = loadFromStorage();
      if (stored) {
        api.setTokens(stored.tokens.accessToken, stored.tokens.refreshToken);
        set({ user: stored.user, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    },
  };
});
