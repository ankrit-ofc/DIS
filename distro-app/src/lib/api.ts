import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "../store/authStore";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://dis-production-00b5.up.railway.app/api";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Attach token from SecureStore before every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("distro_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle responses — auto-logout on 401 (expired / invalid token)
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      // Clear SecureStore + reset Zustand auth state in one call.
      // RootNavigator observes `token` and will automatically switch
      // to AuthStack (Login screen) when it becomes null.
      await useAuthStore.getState().logout();
    }

    const message =
      err.response?.data?.error ??
      err.response?.data?.message ??
      err.message ??
      "Network error";
    return Promise.reject(new Error(message));
  }
);
