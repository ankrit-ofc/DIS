import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("distro-auth");
      if (raw) {
        const parsed = JSON.parse(raw);
        const token = parsed?.state?.token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch {
      // ignore
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("distro-auth");
      localStorage.removeItem("distro-cart");
      document.cookie = "distro-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      document.cookie = "distro-role=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
