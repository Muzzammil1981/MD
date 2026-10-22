import { useState } from "react";
import { Star } from "lucide-react";

/* Read-only stars (supports halves via fill width) */
export function Stars({ value = 0, size = 14, className = "" }) {
    return (
        <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${value} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((i) => {
                const fill = Math.max(0, Math.min(1, value - (i - 1)));
                return (
                    <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
                        <Star size={size} className="absolute inset-0 text-[#d9c7ae]" />
                        <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                            <Star size={size} className="fill-[#c8923a] text-[#c8923a]" />
                        </span>
                    </span>
                );
            })}
        </span>
    );
}

/* Clickable stars for the review form */
export function StarInput({ value, onChange, size = 34 }) {
    const [hover, setHover] = useState(0);
    const shown = hover || value;
    return (
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((i) => (
                <button
                    key={i}
                    type="button"
                    onClick={() => onChange(i)}
                    onMouseEnter={() => setHover(i)}
                    aria-label={`${i} star${i > 1 ? "s" : ""}`}
                    className="rounded-full p-0.5 transition active:scale-90"
                >
                    <Star size={size} className={i <= shown ? "fill-[#c8923a] text-[#c8923a]" : "text-[#d9c7ae]"} />
                </button>
            ))}
        </div>
    );
}

export const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
