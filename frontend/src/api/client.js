import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true
});

export const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

export const fileUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_ORIGIN}${path}`;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("dms_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("dms_token");
      localStorage.removeItem("dms_user");
    }
    return Promise.reject(error);
  }
);
