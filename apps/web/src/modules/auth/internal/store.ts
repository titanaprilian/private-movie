import { create } from 'zustand';
import type {
  User,
  VerifyCredentialsInput,
  RegisterInput,
} from '@repo/contracts';
import { api, extractErrorMessage, setAccessToken } from '@/lib/api';

interface AuthResponseData {
  user?: User;
  tokens?: {
    accessToken?: string;
  };
  [key: string]: unknown;
}

function handleAuthSuccess(
  set: (state: Partial<AuthState>) => void,
  responseData: AuthResponseData
): boolean {
  const rawUser = (responseData.user || responseData) as User;
  const user: User = {
    ...rawUser,
    createdAt: new Date(rawUser.createdAt),
  };
  const accessToken = responseData.tokens?.accessToken;

  if (accessToken) {
    setAccessToken(accessToken);
  }

  set({
    user,
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });
  return true;
}

function handleAuthFailure(
  set: (state: Partial<AuthState>) => void,
  errorMessage: string
): boolean {
  setAccessToken(null);
  set({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: errorMessage,
  });
  return false;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  checkAuth: () => Promise<void>;
  login: (credentials: VerifyCredentialsInput) => Promise<boolean>;
  register: (credentials: RegisterInput) => Promise<boolean>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.auth.me.get();

      if (res.data && 'data' in res.data && res.data.data) {
        const rawUser = res.data.data as User;
        const user: User = {
          ...rawUser,
          createdAt: new Date(rawUser.createdAt),
        };
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else if (res.status === 401) {
        // The backend explicitly rejected the session: evict it.
        setAccessToken(null);
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      } else {
        // Network/gateway failure (502/503/504, connection loss, …):
        // keep the stored token and current session untouched so a
        // transient backend outage is not mistaken for a logout.
        set({ isLoading: false, error: null });
      }
    } catch {
      // fetch itself threw (server unreachable, DNS failure, offline):
      // preserve the stored token and session state.
      set({ isLoading: false, error: null });
    }
  },

  login: async (credentials: VerifyCredentialsInput) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.auth.login.post(credentials);
      if (res.data && 'data' in res.data && res.data.data) {
        return handleAuthSuccess(set, res.data.data as AuthResponseData);
      }
      return handleAuthFailure(
        set,
        extractErrorMessage(res.error, 'Login failed')
      );
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      return handleAuthFailure(set, errorMessage);
    }
  },

  register: async (credentials: RegisterInput) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.auth.register.post(credentials);
      if (res.data && 'data' in res.data && res.data.data) {
        return handleAuthSuccess(set, res.data.data as AuthResponseData);
      }
      return handleAuthFailure(
        set,
        extractErrorMessage(res.error, 'Registration failed')
      );
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      return handleAuthFailure(set, errorMessage);
    }
  },

  logout: async () => {
    try {
      await api.auth.logout.post({});
    } catch {
      // Ignore logout network errors
    }
    setAccessToken(null);
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  logoutAll: async () => {
    try {
      await api.auth['logout-all'].post({});
    } catch {
      // Ignore logout network errors
    }
    setAccessToken(null);
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },
}));
