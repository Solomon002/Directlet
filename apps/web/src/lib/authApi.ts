import axios from "axios";

export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// A plain client for the auth routes. It has no interceptors, so a failed
// refresh can never trigger another refresh.
export const authApi = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});
