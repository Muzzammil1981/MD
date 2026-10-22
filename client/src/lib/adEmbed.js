/* Convert common video URLs to embeddable URLs */

export function toEmbedUrl(rawUrl) {
    if (!rawUrl) return { source: null, embedUrl: "" };
    const url = String(rawUrl).trim();

    // YouTube: watch?v= · youtu.be/ · /shorts/ · /embed/
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
    if (yt) {
        const id = yt[1];
        return {
            source: "youtube",
            embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&rel=0&modestbranding=1&playsinline=1`,
        };
    }

    // Instagram post / reel / tv
    const ig = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    if (ig) {
        return {
            source: "instagram",
            embedUrl: `https://www.instagram.com/p/${ig[1]}/embed/`,
        };
    }

    // Facebook video
    if (/facebook\.com\/.+\/videos\//.test(url) || /fb\.watch\//.test(url)) {
        return {
            source: "facebook",
            embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=1&mute=1&controls=0`,
        };
    }

    // Twitter / X
    const tw = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/);
    if (tw) {
        return {
            source: "twitter",
            embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${tw[2]}`,
        };
    }

    // Direct video file
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
        return { source: "video", embedUrl: url };
    }

    // Fallback: use as-is
    return { source: "iframe", embedUrl: url };
}