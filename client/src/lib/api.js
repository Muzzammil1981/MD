import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const api = axios.create({ baseURL: API_BASE });

/* The business this page belongs to (from the address bar: /barber → "barber").
   Sent on every request so the server answers for THAT business. Admin pages set it from "Working in". */
let industrySlug = null;
export const setIndustrySlug = (slug) => { industrySlug = slug || null; };
export const getIndustrySlug = () => industrySlug;

api.interceptors.request.use((config) => {
    // On /admin → use admin token. Everywhere else → prefer the buyer's user token.
    const isAdminContext = window.location.pathname.startsWith("/admin");
    const adminToken = localStorage.getItem("mehndi-token");
    const userToken = localStorage.getItem("mehndi-user-token");

    const token = isAdminContext
        ? (adminToken || userToken)
        : (userToken || adminToken);

    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (industrySlug) config.headers["X-Industry"] = industrySlug;
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