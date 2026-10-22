import defaultRules from "./_default/rules.js";
import mehndiProfile from "./mehndi/profile.js";   import mehndiRules from "./mehndi/rules.js";
import barberProfile from "./barber/profile.js";   import barberRules from "./barber/rules.js";
import salonProfile from "./salon/profile.js";     import salonRules from "./salon/rules.js";
import carwashProfile from "./carwash/profile.js"; import carwashRules from "./carwash/rules.js";

/* Register an industry here after creating its folder (profile.js + rules.js). */
export const INDUSTRIES = {
    mehndi: mehndiProfile,
    barber: barberProfile,
    salon: salonProfile,
    carwash: carwashProfile,
};

const RULE_OVERRIDES = { mehndi: mehndiRules, barber: barberRules, salon: salonRules, carwash: carwashRules };

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
function merge(base, extra) {
    const out = { ...base };
    for (const [k, v] of Object.entries(extra || {})) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
    return out;
}

/** The rules of an industry = _default + that industry's own differences.
 *  A custom industry (added in the SuperAdmin screen) uses the rules of the template it was copied from. */
export function getRulesFor(key, baseKey) {
    return merge(defaultRules, RULE_OVERRIDES[key] || RULE_OVERRIDES[baseKey] || {});
}
