"use client";

import { createContext, type ReactNode, useContext, useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";

const authStorageKey = "icheck-authenticated";
const demoUsername = "admin";
const demoPassword = "admin123";
const authListeners = new Set<() => void>();

type AuthContextValue = {
  authenticated: boolean;
  hydrated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authenticated = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getServerAuthSnapshot);
  const hydrated = useSyncExternalStore(subscribeToAuth, getHydratedSnapshot, getServerHydratedSnapshot);

  function login(username: string, password: string) {
    const valid = username.trim() === demoUsername && password === demoPassword;
    if (valid) {
      window.sessionStorage.setItem(authStorageKey, "true");
      notifyAuthChange();
    }
    return valid;
  }

  function logout() {
    window.sessionStorage.removeItem(authStorageKey);
    notifyAuthChange();
  }

  return <AuthContext.Provider value={{ authenticated, hydrated, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth 必须在 AuthProvider 内使用。");
  return context;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { authenticated, hydrated } = useAuth();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (!hydrated || isLoginPage || authenticated) return;
    router.replace(`/login?from=${encodeURIComponent(pathname)}`);
  }, [authenticated, hydrated, isLoginPage, pathname, router]);

  if (isLoginPage) return <>{children}</>;
  if (!hydrated || !authenticated) return <AuthLoadingState />;
  return <>{children}</>;
}

function AuthLoadingState() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4"><section aria-live="polite" className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" /><p className="mt-4 text-sm text-slate-500">正在验证登录状态...</p></section></main>;
}

function subscribeToAuth(listener: () => void) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

function notifyAuthChange() {
  authListeners.forEach((listener) => listener());
}

function getAuthSnapshot() {
  return window.sessionStorage.getItem(authStorageKey) === "true";
}

function getServerAuthSnapshot() {
  return false;
}

function getHydratedSnapshot() {
  return true;
}

function getServerHydratedSnapshot() {
  return false;
}
