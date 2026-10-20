import { authApi } from "./authApi";
import { useAuthStore, type User } from "../stores/authStore";

type SessionResponse = { user: User; accessToken: string };

// Every refresh rotates the token, so two refreshes at once with the same cookie
// could look like theft. All callers share one request instead.
let refreshPromise: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshPromise ??= authApi
    .post<SessionResponse>("/auth/refresh")
    .then((res) => {
      useAuthStore.getState().setSession(res.data.user, res.data.accessToken);
      return true;
    })
    .catch(() => {
      useAuthStore.getState().clearSession();
      return false;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

// Runs once when the app starts. React development mode runs startup code twice,
// so this is guarded to make only one request.
let startPromise: Promise<void> | null = null;

export function startSession(): Promise<void> {
  startPromise ??= refreshSession().then(() => undefined);
  return startPromise;
}

export async function login(email: string, password: string): Promise<User> {
  const res = await authApi.post<SessionResponse>("/auth/login", { email, password });
  useAuthStore.getState().setSession(res.data.user, res.data.accessToken);
  return res.data.user;
}

export async function register(input: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<User> {
  const res = await authApi.post<SessionResponse>("/auth/register", input);
  useAuthStore.getState().setSession(res.data.user, res.data.accessToken);
  return res.data.user;
}

// Logout always clears the local session, even if the server cannot be reached.
export async function logout(): Promise<void> {
  await authApi.post("/auth/logout").catch(() => undefined);
  useAuthStore.getState().clearSession();
}
