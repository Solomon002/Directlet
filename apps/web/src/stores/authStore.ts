import { create } from "zustand";

export type UserRole = "LANDLORD" | "TENANT" | "HUNTER" | "ADMIN";

export type User = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

// "checking" lasts until the first session check finishes, so the app does not
// flash the login screen on page reload.
type Status = "checking" | "authenticated" | "anonymous";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  status: Status;
  setSession: (user: User, accessToken: string) => void;
  clearSession: () => void;
};

// Memory only. Nothing here is written to localStorage or sessionStorage.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: "checking",
  setSession: (user, accessToken) => set({ user, accessToken, status: "authenticated" }),
  clearSession: () => set({ user: null, accessToken: null, status: "anonymous" }),
}));
