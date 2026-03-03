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

const STORAGE_KEY = "centsible-user";

function saveToStorage(user: User) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ user }));
}

function loadFromStorage(): { user: User } | null {
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
  api.onAuthError(() => {
    clearStorage();
    api.clearTokens();
    set({ user: null, isAuthenticated: false, isLoading: false });
  });

  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,

    login: async (email: string, password: string) => {
      const result = await api.login({ email, password });
      const { user } = result.data;
      saveToStorage(user);
      set({ user, isAuthenticated: true });
    },

    register: async (email: string, password: string, name: string, defaultCurrency?: string) => {
      const result = await api.register({ email, password, name, defaultCurrency });
      const { user } = result.data;
      saveToStorage(user);
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
        set({ user: stored.user, isAuthenticated: true });
      }

      api
        .getCurrentUser()
        .then((result) => {
          const user = result.data.user;
          saveToStorage(user);
          set({ user, isAuthenticated: true, isLoading: false });
        })
        .catch(() => {
          clearStorage();
          set({ user: null, isAuthenticated: false, isLoading: false });
        });
    },
  };
});
