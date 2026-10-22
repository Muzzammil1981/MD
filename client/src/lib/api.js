import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
    // On /admin → use admin token. Everywhere else → prefer the buyer's user token.
    const isAdminContext = window.location.pathname.startsWith("/admin");
    const adminToken = localStorage.getItem("mehndi-token");
    const userToken = localStorage.getItem("mehndi-user-token");

    const token = isAdminContext
        ? (adminToken || userToken)
        : (userToken || adminToken);

    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (r) => r,
    (err) => {
        if (err.response?.status === 401) {
            const isAdminContext = window.location.pathname.startsWith("/admin");
            localStorage.removeItem(isAdminContext ? "mehndi-token" : "mehndi-user-token");
        }
        return Promise.reject(err);
    }
);