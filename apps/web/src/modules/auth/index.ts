import { useAuthStore } from './internal/store';
import {
  LoginForm,
  type LoginFormProps,
} from './internal/components/LoginForm';
import {
  RegisterForm,
  type RegisterFormProps,
} from './internal/components/RegisterForm';
import {
  LogoutButton,
  type LogoutButtonProps,
} from './internal/components/LogoutButton';
import {
  ViewerLoginForm,
  type ViewerLoginFormProps,
} from './internal/components/ViewerLoginForm';
import {
  ViewerLoginPage,
  type ViewerLoginPageProps,
} from './internal/components/ViewerLoginPage';
import {
  ViewerLoginShowcase,
} from './internal/components/ViewerLoginShowcase';
import {
  AdminLoginForm,
  type AdminLoginFormProps,
} from './internal/components/AdminLoginForm';
import {
  AdminLoginPage,
  type AdminLoginPageProps,
} from './internal/components/AdminLoginPage';
import {
  AdminLoginShowcase,
} from './internal/components/AdminLoginShowcase';
import {
  registerSchema,
  loginSchema,
  type RegisterSchema,
  type LoginSchema,
} from './internal/schema';

export const useAuth = () => {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const logout = useAuthStore((state) => state.logout);
  const logoutAll = useAuthStore((state) => state.logoutAll);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    checkAuth,
    login,
    register,
    logout,
    logoutAll,
  };
};

export async function checkAuthSession(): Promise<boolean> {
  const store = useAuthStore.getState();

  if (!store.isAuthenticated && !store.user) {
    await store.checkAuth();
  }

  return useAuthStore.getState().isAuthenticated;
}

export {
  LoginForm,
  type LoginFormProps,
  RegisterForm,
  type RegisterFormProps,
  LogoutButton,
  type LogoutButtonProps,
  ViewerLoginForm,
  type ViewerLoginFormProps,
  ViewerLoginPage,
  type ViewerLoginPageProps,
  ViewerLoginShowcase,
  AdminLoginForm,
  type AdminLoginFormProps,
  AdminLoginPage,
  type AdminLoginPageProps,
  AdminLoginShowcase,
  registerSchema,
  loginSchema,
  type RegisterSchema,
  type LoginSchema,
};

