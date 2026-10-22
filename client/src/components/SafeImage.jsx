import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * Drop-in <img> replacement.
 *  - No src            -> shows a placeholder, never sends a request
 *  - Load error        -> retries (with cache-bust) up to `retries` times
 *  - Still failing     -> shows a placeholder instead of a broken-image icon
 *
 * Props:
 *  eager             load immediately instead of lazy
 *  retries           number of retries (default 2)
 *  fallbackClassName classes for the placeholder (defaults to className)
 */
export default function SafeImage({
    src,
    alt = "",
    className = "",
    fallbackClassName,
    eager = false,
    retries = 2,
    ...rest
}) {
    const [attempt, setAttempt] = useState(0);
    const [failed, setFailed] = useState(false);
    const timer = useRef(null);

    /* Reset whenever the source changes; clear any pending retry on unmount */
    useEffect(() => {
        setAttempt(0);
        setFailed(false);
        return () => clearTimeout(timer.current);
    }, [src]);

    if (!src || failed) {
        return (
            <div
                role="img"
                aria-label={alt}
                className={`grid place-items-center bg-[#eadcc9] text-[#b49a80] ${fallbackClassName ?? className}`}
            >
                <ImageOff size={22} />
            </div>
        );
    }

    const url = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}r=${attempt}`;

    const handleError = () => {
        if (attempt < retries) {
            timer.current = setTimeout(() => setAttempt(a => a + 1), 600 * (attempt + 1));
        } else {
            setFailed(true);
        }
    };

    return (
        <img
            src={url}
            alt={alt}
            className={className}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            onError={handleError}
            {...rest}
        />
    );
}