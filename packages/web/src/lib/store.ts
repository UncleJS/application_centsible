import { create } from "zustand";
import { api } from "@/lib/api";
import { toast } from "sonner";

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
  updateUser: (partial: Partial<User>) => void;
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

    updateUser: (partial: Partial<User>) => {
      set((state) => {
        if (!state.user) return state;
        const updated = { ...state.user, ...partial };
        saveToStorage(updated);
        return { user: updated };
      });
    },
  };
});

// ── Exchange Rate Store ───────────────────────────────────────────────────────
// Caches rates in localStorage for 12 hours. On consecutive failures (≥ 2)
// after the cache has expired, shows a persistent toast warning.

const EXCHANGE_RATE_STORAGE_KEY = "centsible-exchange-rates";
const EXCHANGE_RATE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const FAILURE_TOAST_THRESHOLD = 2;

interface ExchangeRateCache {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number; // Unix ms
}

interface ExchangeRateState {
  rates: Record<string, number>;
  base: string;
  fetchedAt: number | null;
  consecutiveFailures: number;
  // Fetch rates for `base` currency — uses cache if < 12h old, otherwise calls API.
  // Call this from any page that needs exchange rates; it is safe to call concurrently.
  fetchRates: (base: string) => Promise<void>;
}

function loadCachedRates(base: string): ExchangeRateCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(EXCHANGE_RATE_STORAGE_KEY);
    if (!raw) return null;
    const cached: ExchangeRateCache = JSON.parse(raw);
    if (cached.base !== base) return null; // different currency — stale
    return cached;
  } catch {
    return null;
  }
}

function saveCachedRates(cache: ExchangeRateCache) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EXCHANGE_RATE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // storage quota exceeded — ignore
  }
}

export const useExchangeRateStore = create<ExchangeRateState>((set, get) => ({
  rates: {},
  base: "",
  fetchedAt: null,
  consecutiveFailures: 0,

  fetchRates: async (base: string) => {
    const now = Date.now();
    const { fetchedAt, base: cachedBase, consecutiveFailures } = get();

    // 1. In-memory cache still valid (same base, < 12h old)
    if (
      cachedBase === base &&
      fetchedAt !== null &&
      now - fetchedAt < EXCHANGE_RATE_TTL_MS
    ) {
      return;
    }

    // 2. Check localStorage cache (survives page navigations)
    const stored = loadCachedRates(base);
    if (stored && now - stored.fetchedAt < EXCHANGE_RATE_TTL_MS) {
      set({
        rates: stored.rates,
        base: stored.base,
        fetchedAt: stored.fetchedAt,
        consecutiveFailures: 0,
      });
      return;
    }

    // 3. Cache is stale or missing — fetch fresh rates
    try {
      const res = await api.getLatestRates(base);
      const rates = res.data?.rates ?? {};
      const cache: ExchangeRateCache = { base, rates, fetchedAt: now };
      saveCachedRates(cache);
      set({ rates, base, fetchedAt: now, consecutiveFailures: 0 });
    } catch {
      const newFailures = consecutiveFailures + 1;
      set({ consecutiveFailures: newFailures });

      // Keep using stale cached rates if available
      if (stored) {
        set({ rates: stored.rates, base: stored.base, fetchedAt: stored.fetchedAt });
      }

      // Notify user after reaching the failure threshold
      if (newFailures >= FAILURE_TOAST_THRESHOLD) {
        toast.warning(
          `Exchange rates could not be refreshed (${newFailures} consecutive failure${newFailures > 1 ? "s" : ""}). Currency conversions may be outdated.`,
          { id: "exchange-rate-failure", duration: Infinity }
        );
      }
    }
  },
}));
