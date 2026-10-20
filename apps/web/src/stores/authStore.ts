import { create } from 'zustand';

export type User = {
  id: string;
  email: string;
  fullName: string;
  role: 'landlord' | 'tenant';
};

type AuthState = {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('accessToken'),
  setAuth: (user, token) => {
    localStorage.setItem('accessToken', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    set({ user: null, token: null });
  },
}));
