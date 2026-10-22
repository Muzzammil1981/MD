/* =====================================================================
   DEFAULT BUSINESS RULES  (every industry starts from this)
   ---------------------------------------------------------------------
   Rules come in TWO kinds:
     1. SWITCHES  - simple settings the SuperAdmin will be able to change in the Business tab.
                    They live in this file as defaults; a folder's rules.js only lists what is DIFFERENT.
     2. HOOKS     - real code for special cases (extra checks, pricing formulas, workflow steps).
                    Put them in  industries/<key>/rules.js  - a developer edits these.

   To give an industry its own rules: edit  industries/<key>/rules.js  and export only the differences.
   Adding a new industry folder?  Copy  industries/_template/  and rename it.
   ===================================================================== */
export default {
    /* ---------------- booking ---------------- */
    booking: {
        mode: "slots",              // "slots"  = customer picks a free time slot
                                    // "tokens" = walk-in queue / token numbers (no time slot)
        allowGroup: true,           // several people in one booking
        allowCustomRequests: true,  // "special request" with a quote / counter-offer
        maxItemsPerBooking: 20,
        defaultDurationMinutes: 60, // used when a service has no duration
    },

    /* ---------------- payment ---------------- */
    payment: {
        methods: ["upi", "card", "cash"],
        depositPercent: 0,          // 0 = pay the full amount; 30 = 30% deposit to confirm
        payBeforeService: true,
    },

    /* ---------------- cancellation / changes ---------------- */
    changes: {
        allowCustomerModify: true,
        cancelUntilHoursBefore: 2,
    },

    /* ---------------- extra questions asked at booking (stored per order) ----------------
       Example for a car wash:
         { key: "vehicleNumber", label: "Vehicle number", type: "text",   required: true },
         { key: "vehicleType",   label: "Vehicle type",   type: "select", options: ["Hatchback", "Sedan", "SUV"] }       */
    intakeFields: [],

    /* ---------------- hooks (code) - all optional ---------------- */
    hooks: {
        // validateOrder(order, ctx)   -> throw new Error("message") to refuse a booking
        // computePrice(items, ctx)    -> return a different total (e.g. surcharges)
        // afterCompleted(order, ctx)  -> run something when an order is completed
    },
};
