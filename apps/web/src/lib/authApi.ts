import axios from "axios";

// Online, the API shares the website's address under /api. On a laptop it is a
// separate server. VITE_API_URL overrides both.
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? "/api" : "http://localhost:4000");

// A plain client for the auth routes. It has no interceptors, so a failed
// refresh can never trigger another refresh.
export const authApi = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});
