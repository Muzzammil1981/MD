/* =====================================================================
   AI-assisted wording
   1) buildPrompt()  - text you paste into ANY AI (ChatGPT, Claude, Gemini ...)
   2) parseReply()   - reads the AI's answer (simple "name: value" lines) back into the form
   ===================================================================== */

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function buildPrompt({ industryName, groups, details = "" }) {
    const fields = groups.flatMap((g) => g.fields);
    const lines = [];
    lines.push(`You are a brand copywriter. Write the website wording for a BOOKING website for this business:`);
    lines.push("");
    lines.push(`INDUSTRY / BUSINESS TYPE: ${industryName || "(type the industry here)"}`);
    if (details.trim()) lines.push(`EXTRA DETAILS: ${details.trim()}`);
    lines.push("");
    lines.push("Customers choose items (services/dishes/packages), pick a time or get a token, pay, and leave a review.");
    lines.push("");
    lines.push("RULES");
    lines.push("- Reply with ONLY the lines in the REPLY FORMAT below. No introduction, no explanation, no markdown, no code block.");
    lines.push("- Keep the exact key names before the colon. Write each value on ONE line.");
    lines.push("- Plain text only. Do not use quotation marks around values. At most one emoji where it is allowed.");
    lines.push("- Be specific to the industry. Friendly, short and clear. Respect the length hints.");
    lines.push("- 'item' and 'items' are the word for what customers book (singular / plural, lowercase) - the whole site uses them in sentences.");
    lines.push("- Also write 6 to 8 categories, one per line, using:  category: Name | Short name | Description | Tag line");
    lines.push("");
    lines.push("WHAT EACH KEY MEANS");
    for (const f of fields) lines.push(`- ${f.key}: ${f.label}. ${f.hint || ""}`.trim());
    lines.push("");
    lines.push("REPLY FORMAT (copy these lines and fill in everything after the colon)");
    for (const f of fields) lines.push(`${f.key}: `);
    lines.push("category: ");
    lines.push("category: ");
    lines.push("category: ");
    lines.push("category: ");
    lines.push("category: ");
    lines.push("category: ");
    lines.push("");
    lines.push("EXAMPLE of the style (for a barber shop):");
    lines.push("name: The Barber Shop");
    lines.push("tagline: Sharp cuts. Clean fades.");
    lines.push("item: service");
    lines.push("items: services");
    lines.push("amountTypes: per service | per session | package");
    lines.push("heroTitle1: Look sharp.");
    lines.push("heroTitle2: Feel unstoppable.");
    lines.push("category: Haircuts | Haircuts | Classic cuts, fades and modern styles. | Sharp & clean");
    return lines.join("\n");
}

/* strip bullets, bold, quotes, backticks around a line / value */
const tidy = (s) => s.trim().replace(/^\s*[-*•\d.)]+\s+/, "").replace(/\*\*/g, "").replace(/^["'`“”]+|["'`“”]+$/g, "").trim();

/**
 * text   : what the AI answered
 * groups : the editor's field list (to know the valid keys)
 * returns: { values, categories, unknown[], missing[], filled, tooLong[] }
 */
export function parseReply(text, groups) {
    const fields = groups.flatMap((g) => g.fields);
    const byLower = new Map(fields.map((f) => [f.key.toLowerCase(), f]));
    const values = {};
    const categories = [];
    const unknown = [];
    const tooLong = [];

    for (const raw of String(text || "").split(/\r?\n/)) {
        let line = raw.trim();
        if (!line || line.startsWith("```") || line.startsWith("#") || line.startsWith("//")) continue;
        line = line.replace(/^\s*[-*•]\s+/, "").replace(/\*\*/g, "").replace(/`/g, "");
        const i = line.indexOf(":");
        if (i < 1) continue;
        const key = line.slice(0, i).trim().replace(/[\s_-]+/g, "").toLowerCase();
        const value = tidy(line.slice(i + 1));
        if (!value) continue;

        if (key === "category" || key === "categories") {
            const parts = value.split("|").map((p) => tidy(p));
            if (parts[0] && parts[0].length >= 2) {
                categories.push({
                    name: parts[0].slice(0, 100),
                    shortName: (parts[1] || parts[0]).slice(0, 50),
                    description: (parts[2] || "").slice(0, 500),
                    accent: (parts[3] || "").slice(0, 100),
                });
            }
            continue;
        }
        const f = byLower.get(key);
        if (!f) { unknown.push(line.slice(0, 60)); continue; }
        if (value.length > 600) tooLong.push(f.key);
        // price units: accept  a | b | c   or   a, b, c   -> one per line (how the form stores them)
        values[f.key] = f.type === "list"
            ? value.split(/\s*[|;]\s*|\s*,\s*/).map((x) => x.trim()).filter(Boolean).join("\n")
            : clip(value, 600);
    }

    const filled = Object.keys(values).length;
    const missing = fields.map((f) => f.key).filter((k) => !(k in values));
    return { values, categories, unknown, missing, filled, total: fields.length, tooLong };
}
