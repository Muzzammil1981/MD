import { API_BASE } from "./api";

/**
 * Build a usable image URL.
 *  - imageUrl(path)           -> full-size image
 *  - imageUrl(path, "thumb")  -> small 640px version (grids, cart, search, thumbnails)
 * Images are plain files served from the API at /uploads/...
 * The 640px thumbnail sits next to the full image: /uploads/x/y.webp -> /uploads/x/thumbs/y.webp
 * External http(s) URLs are returned untouched.
 */
export function imageUrl(src, size) {
    if (!src) return "";
    if (src.startsWith("http://") || src.startsWith("https://")) return src;

    if (size === "thumb" && src.startsWith("/uploads/") && !src.includes("/thumbs/")) {
        const i = src.lastIndexOf("/");
        return `${API_BASE}${src.slice(0, i)}/thumbs${src.slice(i)}`;
    }
    return `${API_BASE}${src}`;
}

export function currency(value) {
    return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value || 0);
}