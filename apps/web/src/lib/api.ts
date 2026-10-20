import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_URL } from "./authApi";
import { refreshSession } from "./session";
import { useAuthStore } from "../stores/authStore";

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// For every route except /auth. Sends the access token, and on a 401 tries one
// refresh and then repeats the request.
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = "Bearer " + token;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;

    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      const refreshed = await refreshSession();
      if (refreshed) {
        return api(original);
      }
    }

    return Promise.reject(error);
  },
);
