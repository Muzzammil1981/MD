import crypto from "crypto";
import { query, withTransaction, iso, isoOrEmpty } from "../db/pool.js";
import { reserveEventTokens, reserveDailyTokens } from "./tokenService.js";
import { isAdminRole } from "../middleware/auth.js";
import { money } from "../utils/misc.js";
import { getScheduleSettings, planBooking, reserveSlot } from "./scheduleService.js";
import { getProfile } from "../config/industries.js";
import { adminOrderScope, getAdminIndustries } from "./adminAccess.js";

/* =========================================================
   Row → API shape  (identical JSON to the old Drive version)
   ========================================================= */
const ORDER_SELECT = `
    SELECT o.*, e.Name AS EventName, e.OwnerId AS EventOwnerId
    FROM mehndi.Orders o
    LEFT JOIN mehndi.Events e ON e.Id = o.EventId`;

const toItem = (r) => ({
    id: r.DesignId,
    name: r.Name,
    price: Number(r.Price),
    qty: r.Qty,
    image: r.Image,
    categoryName: r.CategoryName,
    amountType: r.AmountType,
});

function group(rows, key) {
    const map = new Map();
    for (const r of rows) {
        const k = r[key];
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(r);
    }
    return map;
}

function toOrder(r, ch) {
    const total = Number(r.Total) || 0;
    const paidAmount = Number(r.PaidAmount) || 0;
    const items = ch.items.get(r.Id) || [];
    const members = ch.members.get(r.Id) || [];

    const order = {
        id: r.Id,
        userId: r.UserId,
        username: r.Username,
        email: r.Email || "",
        type: r.Type,
        isGroup: r.IsGroup === true,
        members: members.map((m) => ({
            memberId: m.MemberId,
            name: m.Name,
            items: items.filter((i) => i.MemberId === m.MemberId).map(toItem),
            subtotal: Number(m.Subtotal),
            tokenNumber: m.TokenNumber,
            status: m.Status,
            startedAt: isoOrEmpty(m.StartedAt),
            endedAt: isoOrEmpty(m.EndedAt),
            durationSeconds: m.DurationSeconds,
        })),
        items: items.filter((i) => i.MemberId == null).map(toItem),
        total,
        paidAmount,
        balanceDue: Math.max(0, total - paidAmount),
        refundDue: Math.max(0, paidAmount - total),
        requestedDate: r.RequestedDate,
        requestedTime: r.RequestedTime,
        notes: r.Notes,
        status: r.Status,
        paymentMethod: r.PaymentMethod,
        eventId: r.EventId || null,
        eventName: r.EventName || null,
        eventOwnerId: r.EventOwnerId || null,   // the admin who runs this order's event
        industryKey: r.IndustryKey || null,     // the industry this order belongs to
        tokenNumber: r.TokenNumber,
        adminNote: r.AdminNote,
        proposedDate: r.ProposedDate,
        proposedTime: r.ProposedTime,

        customDescription: r.CustomDescription,
        customImageId: r.CustomImageId || null,
        customImage: r.CustomImage || null,
        suggestedPrice: r.SuggestedPrice == null ? null : Number(r.SuggestedPrice),
        quotedPrice: r.QuotedPrice == null ? null : Number(r.QuotedPrice),
        negotiationHistory: (ch.negs.get(r.Id) || []).map((n) => ({
            at: iso(n.At),
            by: n.ByRole,
            action: n.Action,
            ...(n.Price == null ? {} : { price: Number(n.Price) }),
            ...(n.Note == null ? {} : { note: n.Note }),
        })),

        utr: r.Utr,
        paymentClaimedAt: isoOrEmpty(r.PaymentClaimedAt),
        paymentId: r.PaymentId,
        paidAt: isoOrEmpty(r.PaidAt),
        paymentRejectReason: r.PaymentRejectReason,
        paymentRejectedAt: isoOrEmpty(r.PaymentRejectedAt),
        startedAt: isoOrEmpty(r.StartedAt),
        endedAt: isoOrEmpty(r.EndedAt),
        durationSeconds: r.DurationSeconds,
        createdAt: iso(r.CreatedAt),
        updatedAt: iso(r.UpdatedAt),
    };

    if (r.WorkNote != null) order.workNote = r.WorkNote;
    if (r.PreviousTotal != null) order.previousTotal = Number(r.PreviousTotal);
    if (r.TotalDifference != null) order.totalDifference = Number(r.TotalDifference);
    if (r.RefundGivenAt) order.refundGivenAt = iso(r.RefundGivenAt);

    if (ch.mods) {
        order.modifications = (ch.mods.get(r.Id) || []).map((m) => {
            const mi = ch.modItems.get(m.Id) || [];
            return {
                at: iso(m.At),
                previousItems: mi.filter((x) => x.Side === "previous").map(toItem),
                previousTotal: Number(m.PreviousTotal),
                newItems: mi.filter((x) => x.Side === "new").map(toItem),
                newTotal: Number(m.NewTotal),
                difference: Number(m.Difference),
                previousStatus: m.PreviousStatus,
                previousPaidAmount: Number(m.PreviousPaidAmount),
            };
        });
        order.refundHistory = (ch.refunds.get(r.Id) || []).map((x) => ({
            at: iso(x.At), amount: Number(x.Amount), note: x.Note || "",
        }));
    }
    return order;
}

/**
 * Load orders matching `where` (uses alias `o`) together with all child rows.
 * detail=true also loads modification + refund history (single-order view).
 */
async function fetchOrders({ where = "", params = {}, detail = false, orderBy = "ORDER BY o.CreatedAt DESC", db = null } = {}) {
    const rows = await query(`${ORDER_SELECT} ${where} ${orderBy}`, params, db);
    if (!rows.length) return [];

    const sub = `SELECT o.Id FROM mehndi.Orders o ${where}`;
    const items = await query(
        `SELECT * FROM mehndi.OrderItems WHERE OrderId IN (${sub}) ORDER BY OrderId, SortOrder, Id`, params, db);
    const members = await query(
        `SELECT * FROM mehndi.OrderMembers WHERE OrderId IN (${sub}) ORDER BY OrderId, SortOrder`, params, db);
    const negs = await query(
        `SELECT * FROM mehndi.OrderNegotiations WHERE OrderId IN (${sub}) ORDER BY OrderId, At, Id`, params, db);

    const ch = {
        items: group(items, "OrderId"),
        members: group(members, "OrderId"),
        negs: group(negs, "OrderId"),
    };

    if (detail) {
        const mods = await query(
            `SELECT * FROM mehndi.OrderModifications WHERE OrderId IN (${sub}) ORDER BY OrderId, At, Id`, params, db);
        const modItems = await query(
            `SELECT mi.* FROM mehndi.OrderModificationItems mi
             JOIN mehndi.OrderModifications m ON m.Id = mi.ModificationId
             WHERE m.OrderId IN (${sub}) ORDER BY mi.ModificationId, mi.Side, mi.SortOrder`, params, db);
        const refunds = await query(
            `SELECT * FROM mehndi.OrderRefunds WHERE OrderId IN (${sub}) ORDER BY OrderId, At, Id`, params, db);
        ch.mods = group(mods, "OrderId");
        ch.modItems = group(modItems, "ModificationId");
        ch.refunds = group(refunds, "OrderId");
    }
    return rows.map((r) => toOrder(r, ch));
}

export { fetchOrders };

/* =========================================================
   Read
   ========================================================= */
/* SuperAdmin → every order. Admin → only orders placed on events they own.
   Customer → their own orders. */
export async function listOrders({ userId, role }) {
    if (role === "SUPERADMIN") return fetchOrders();
    if (role === "ADMIN") {
        // only the industries this admin was assigned (and, for events, events they created)
        return fetchOrders({ where: `WHERE ${adminOrderScope("o")}`, params: { me: userId } });
    }
    return fetchOrders({ where: "WHERE o.UserId = @u", params: { u: userId } });
}

/** May this signed-in admin act on this order? (SuperAdmin: yes. Admin: only if it is on their event) */
export async function adminCanAccessOrder(user, orderId) {
    if (user.role === "SUPERADMIN") return { found: true, allowed: true };
    const rows = await query(
        `SELECT o.IndustryKey, o.EventId, e.OwnerId
         FROM mehndi.Orders o LEFT JOIN mehndi.Events e ON e.Id = o.EventId WHERE o.Id = @id`,
        { id: orderId });
    if (!rows[0]) return { found: false, allowed: false };
    if (user.role !== "ADMIN") return { found: true, allowed: false };
    const mine = await getAdminIndustries(user.id);
    const industryOk = mine.includes(rows[0].IndustryKey);
    const eventOk = !rows[0].EventId || rows[0].OwnerId === user.id;
    return { found: true, allowed: industryOk && eventOk };
}

export async function getOrder(id) {
    const list = await fetchOrders({ where: "WHERE o.Id = @id", params: { id }, detail: true });
    return list[0] || null;
}

/* =========================================================
   Internal helpers
   ========================================================= */
async function lockOrder(id, tx) {
    const rows = await query(
        `SELECT o.* FROM mehndi.Orders o WITH (UPDLOCK, ROWLOCK) WHERE o.Id = @id`, { id }, tx);
    if (!rows[0]) throw new Error("Order not found");
    return rows[0];
}

/**
 * Prices are ALWAYS taken from the database (event override > catalogue price),
 * never from the browser - a customer can't edit the price in dev-tools.
 */
async function resolveItems(rawItems, eventId, db) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) return [];
    if (rawItems.length > 100) throw new Error("Too many items");

    const ids = [...new Set(rawItems.map((i) => String(i?.id ?? "")))];
    const params = {};
    ids.forEach((id, n) => { params[`d${n}`] = id; });
    const designs = await query(
        `SELECT d.Id, d.Name, d.Price, d.AmountType, d.ImagePath, d.DurationMinutes, c.Name AS CategoryName
         FROM mehndi.Designs d JOIN mehndi.Categories c ON c.Id = d.CategoryId
         WHERE d.Id IN (${ids.map((_, n) => `@d${n}`).join(",")})`,
        params, db
    );
    const byId = new Map(designs.map((d) => [d.Id, d]));

    const overrides = new Map();
    if (eventId) {
        const rows = await query(
            `SELECT DesignId, Price FROM mehndi.EventPriceOverrides WHERE EventId = @e`, { e: eventId }, db);
        rows.forEach((r) => overrides.set(r.DesignId, Number(r.Price)));
    }

    return rawItems.map((raw) => {
        const d = byId.get(String(raw.id));
        if (!d) throw new Error(`"${raw.name || raw.id}" is no longer available`);
        const qty = Math.floor(Number(raw.qty));
        if (!Number.isFinite(qty) || qty < 1 || qty > 100) throw new Error(`Invalid quantity for "${d.Name}"`);
        return {
            designId: d.Id,
            name: d.Name,
            price: overrides.has(d.Id) ? overrides.get(d.Id) : Number(d.Price),
            qty,
            image: d.ImagePath,
            categoryName: d.CategoryName,
            amountType: d.AmountType,
            durationMinutes: d.DurationMinutes || 60,
        };
    });
}

const sumItems = (items) => money(items.reduce((n, x) => n + x.qty * x.price, 0));

async function insertItems(orderId, memberId, items, tx) {
    for (const [i, it] of items.entries()) {
        await query(
            `INSERT INTO mehndi.OrderItems (OrderId, MemberId, SortOrder, DesignId, Name, Price, Qty, Image, CategoryName, AmountType)
             VALUES (@o, @m, @s, @d, @n, @p, @q, @img, @cat, @amt)`,
            {
                o: orderId, m: memberId, s: i, d: it.designId, n: it.name, p: it.price, q: it.qty,
                img: it.image || null, cat: it.categoryName || null, amt: it.amountType || null,
            },
            tx
        );
    }
}

/* Give every member (group) or the order itself (event single) a token - only if missing. */
async function ensureTokens(o, tx) {
    if (o.IsGroup === true) {
        const missing = await query(
            `SELECT MemberId FROM mehndi.OrderMembers WHERE OrderId = @id AND TokenNumber IS NULL ORDER BY SortOrder`,
            { id: o.Id }, tx);
        if (!missing.length) return;
        const tokens = o.EventId
            ? await reserveEventTokens(o.EventId, missing.length, tx)
            : await reserveDailyTokens(missing.length, tx);
        for (const [i, m] of missing.entries()) {
            await query(
                `UPDATE mehndi.OrderMembers SET TokenNumber = @t WHERE OrderId = @id AND MemberId = @m`,
                { t: tokens[i], id: o.Id, m: m.MemberId }, tx);
        }
    } else if (o.EventId && o.TokenNumber == null) {
        const [t] = await reserveEventTokens(o.EventId, 1, tx);
        await query(`UPDATE mehndi.Orders SET TokenNumber = @t WHERE Id = @id`, { t, id: o.Id }, tx);
    }
}

const touch = `UpdatedAt = SYSUTCDATETIME()`;

/* =========================================================
   CREATE ORDER
   ========================================================= */
export async function createOrder({
    user, items, requestedDate, requestedTime, notes,
    eventId, status, paymentMethod,
    type, customDescription, customImageId, customImage, suggestedPrice,
    isGroup, members,
}) {
    if (!user?.id) throw new Error("You must be signed in");

    if (type === "custom") {
        if (!customDescription?.trim()) throw new Error(`Please describe your ${getProfile().custom}`);
        if (!suggestedPrice || Number(suggestedPrice) <= 0) throw new Error(`Please suggest a price for your ${getProfile().custom}`);
        if (!eventId) {
            if (!requestedDate) throw new Error("Appointment date is required");
            if (!requestedTime) throw new Error("Appointment time is required");
        }
    } else if (isGroup) {
        if (!Array.isArray(members) || members.length < 2) throw new Error("Group bookings require at least 2 members");
        if (members.some((m) => !m.name?.trim())) throw new Error("Every group member needs a name");
        if (members.some((m) => !Array.isArray(m.items) || m.items.length === 0)) throw new Error(`Each member needs at least one ${getProfile().item}`);
        if (!requestedDate) throw new Error("Appointment date is required");
        if (!requestedTime) throw new Error("Appointment time is required");
    } else {
        if (!items?.length) throw new Error("Cart is empty");
        if (!requestedDate) throw new Error("Appointment date is required");
        if (!requestedTime) throw new Error("Appointment time is required");
    }

    const orderId = crypto.randomUUID();

    await withTransaction(async (tx) => {
        let industryKey = getProfile().industry;          // normal bookings: the industry that is live now
        if (eventId) {
            const ev = await query(`SELECT Id, IndustryKey FROM mehndi.Events WHERE Id = @e`, { e: eventId }, tx);
            if (!ev[0]) throw new Error("Event not found");
            industryKey = ev[0].IndustryKey || industryKey;   // event orders: the event's industry
        }

        let total = 0;
        let singleItems = [];
        let memberRows = [];

        if (isGroup && type !== "custom") {
            memberRows = [];
            for (const [i, m] of members.entries()) {
                const mItems = await resolveItems(m.items, eventId, tx);
                memberRows.push({
                    memberId: String(m.memberId || `m-${i + 1}`),
                    name: String(m.name || `Member ${i + 1}`).trim(),
                    items: mItems,
                    subtotal: sumItems(mItems),
                });
            }
            total = money(memberRows.reduce((n, m) => n + m.subtotal, 0));
        } else if (type !== "custom") {
            singleItems = await resolveItems(items, eventId, tx);
            total = sumItems(singleItems);
        }

        // Normal (non-event) bookings occupy a real time slot - checked + reserved atomically.
        let slot = null;
        if (!eventId && type !== "custom") {
            const settings = await getScheduleSettings(tx);
            const plan = planBooking(
                { isGroup: Boolean(isGroup), items: singleItems, members: memberRows },
                settings.stations
            );
            slot = await reserveSlot(
                { date: requestedDate, time: requestedTime, minutes: plan.minutes, stations: plan.stations }, tx);
        }

        await query(
            `INSERT INTO mehndi.Orders
               (Id, UserId, Username, Email, Type, IsGroup, Total, PaidAmount, RequestedDate, RequestedTime,
                Notes, Status, PaymentMethod, EventId, CustomDescription, CustomImageId, CustomImage, SuggestedPrice,
                SlotDate, SlotStartMin, SlotMinutes, SlotStations, IndustryKey)
             VALUES
               (@id, @uid, @uname, @email, @type, @grp, @total, 0, @rd, @rt,
                @notes, @status, @pm, @ev, @cd, @cimgid, @cimg, @sp,
                @sd, @sm, @smin, @sst, @ind)`,
            {
                id: orderId,
                uid: user.id,
                uname: user.username,
                email: user.email || null,
                type: type || "standard",
                grp: Boolean(isGroup) && type !== "custom",
                total,
                rd: requestedDate || null,
                rt: requestedTime || null,
                notes: String(notes || "").trim(),
                status: status || "pending",
                pm: paymentMethod || "upi",
                ev: eventId || null,
                cd: String(customDescription || "").trim(),
                cimgid: customImageId || null,
                cimg: customImage || null,
                sp: suggestedPrice ? Number(suggestedPrice) : null,
                sd: slot ? slot.date : null,
                sm: slot ? slot.startMin : null,
                smin: slot ? slot.minutes : null,
                sst: slot ? slot.stations : null,
                ind: industryKey,
            },
            tx
        );

        for (const [i, m] of memberRows.entries()) {
            await query(
                `INSERT INTO mehndi.OrderMembers (OrderId, MemberId, SortOrder, Name, Subtotal)
                 VALUES (@o, @m, @s, @n, @sub)`,
                { o: orderId, m: m.memberId, s: i, n: m.name, sub: m.subtotal }, tx);
            await insertItems(orderId, m.memberId, m.items, tx);
        }
        await insertItems(orderId, null, singleItems, tx);
    });

    return getOrder(orderId);
}

/* =========================================================
   Admin: approve / reject / reschedule
   ========================================================= */
export async function updateOrderStatus({ id, status, adminNote, proposedDate, proposedTime }) {
    if (!["approved", "rejected"].includes(status)) throw new Error("Invalid status");
    await withTransaction(async (tx) => {
        const o = await lockOrder(id, tx);

        // The admin moved the appointment → the slot must move too (and be free)
        if (status === "approved" && proposedDate && proposedTime && o.SlotMinutes != null) {
            const slot = await reserveSlot(
                { date: proposedDate, time: proposedTime, minutes: o.SlotMinutes, stations: o.SlotStations || 1, excludeOrderId: id }, tx);
            await query(
                `UPDATE mehndi.Orders SET SlotDate=@d, SlotStartMin=@m WHERE Id=@id`,
                { id, d: slot.date, m: slot.startMin }, tx);
        }

        await query(
            `UPDATE mehndi.Orders
                SET Status=@s, AdminNote=@n, ProposedDate=@pd, ProposedTime=@pt, ${touch}
              WHERE Id=@id`,
            { id, s: status, n: String(adminNote || "").trim(), pd: proposedDate || "", pt: proposedTime || "" }, tx);
    });
    return getOrder(id);
}

/* ---------- User: choose payment method ---------- */
export async function setPaymentMethod({ id, userId, method }) {
    if (!["upi", "card", "cash"].includes(method)) throw new Error("Invalid payment method");
    await withTransaction(async (tx) => {
        const o = await lockOrder(id, tx);
        if (o.UserId !== userId) throw new Error("Forbidden");
        if (o.Status !== "approved" && o.Status !== "pending") throw new Error("Order is not in a modifiable state");
        await query(`UPDATE mehndi.Orders SET PaymentMethod=@m, ${touch} WHERE Id=@id`, { id, m: method }, tx);
    });
    return getOrder(id);
}

/* =========================================================
   User: modify order items
   Only the DIFFERENCE is charged when already paid:
     new total > paid  → needs a top-up payment
     new total = paid  → stays paid
     new total < paid  → stays paid, refund due
   ========================================================= */
export async function updateOrderItems({ id, userId, items }) {
    if (!Array.isArray(items) || items.length === 0) throw new Error(`Order must contain at least one ${getProfile().item}`);

    await withTransaction(async (tx) => {
        const o = await lockOrder(id, tx);
        if (o.UserId !== userId) throw new Error("Forbidden");
        if (o.IsGroup === true) throw new Error("Group orders can't be modified");

        const modifiable = ["pending", "approved", "awaiting-verification", "paid"];
        if (!modifiable.includes(o.Status)) throw new Error("This order can no longer be modified. Please contact the studio.");

        const newItems = await resolveItems(items, o.EventId, tx);
        const newTotal = sumItems(newItems);
        if (newTotal <= 0) throw new Error("New total must be greater than 0");

        const previousTotal = Number(o.Total);
        const previousPaid = Number(o.PaidAmount) || 0;
        const difference = money(newTotal - previousTotal);
        const balanceDue = Math.max(0, newTotal - previousPaid);

        // --- history: previous + new lines ---
        const prevRows = await query(
            `SELECT * FROM mehndi.OrderItems WHERE OrderId=@id AND MemberId IS NULL ORDER BY SortOrder, Id`, { id }, tx);
        const mod = await query(
            `INSERT INTO mehndi.OrderModifications (OrderId, PreviousTotal, NewTotal, Difference, PreviousStatus, PreviousPaidAmount)
             OUTPUT INSERTED.Id
             VALUES (@id, @pt, @nt, @diff, @ps, @pp)`,
            { id, pt: previousTotal, nt: newTotal, diff: difference, ps: o.Status, pp: previousPaid }, tx);
        const modId = mod[0].Id;
        const logLine = (side, i, x) => query(
            `INSERT INTO mehndi.OrderModificationItems (ModificationId, Side, SortOrder, DesignId, Name, Price, Qty, Image, CategoryName, AmountType)
             VALUES (@m, @side, @s, @d, @n, @p, @q, @img, @cat, @amt)`,
            { m: modId, side, s: i, d: x.designId, n: x.name, p: x.price, q: x.qty, img: x.image || null, cat: x.categoryName || null, amt: x.amountType || null }, tx);
        for (const [i, r] of prevRows.entries()) {
            await logLine("previous", i, { designId: r.DesignId, name: r.Name, price: r.Price, qty: r.Qty, image: r.Image, categoryName: r.CategoryName, amountType: r.AmountType });
        }
        for (const [i, x] of newItems.entries()) await logLine("new", i, x);

        // --- the booking may now take longer/shorter: keep the slot consistent ---
        if (o.SlotMinutes != null) {
            const settings = await getScheduleSettings(tx);
            const newMinutes = planBooking({ isGroup: false, items: newItems }, settings.stations).minutes;
            if (newMinutes > o.SlotMinutes) {
                const hh = String(Math.floor(o.SlotStartMin / 60)).padStart(2, "0");
                const mm = String(o.SlotStartMin % 60).padStart(2, "0");
                await reserveSlot(
                    {
                        date: new Date(o.SlotDate).toISOString().slice(0, 10), time: `${hh}:${mm}`,
                        minutes: newMinutes, stations: 1, excludeOrderId: id, keepPast: true,
                    }, tx);
            }
            await query(`UPDATE mehndi.Orders SET SlotMinutes=@m WHERE Id=@id`, { id, m: newMinutes }, tx);
        }

        // --- apply ---
        await query(`DELETE FROM mehndi.OrderItems WHERE OrderId=@id AND MemberId IS NULL`, { id }, tx);
        await insertItems(id, null, newItems, tx);

        let status;
        let clearPayment = false;
        if (balanceDue > 0) {
            // customer still owes money → another payment round (but a still-unapproved
            // booking must not skip the admin's approval)
            status = o.Status === "pending" ? "pending" : "approved";
            clearPayment = status === "approved";
        } else {
            status = "paid";
            clearPayment = o.Status === "awaiting-verification";
        }

        await query(
            `UPDATE mehndi.Orders
                SET Total=@t, PreviousTotal=@pt, TotalDifference=@diff, Status=@s,
                    Utr = CASE WHEN @clear = 1 THEN N'' ELSE Utr END,
                    PaymentClaimedAt = CASE WHEN @clear = 1 THEN NULL ELSE PaymentClaimedAt END,
                    PaymentRejectReason = CASE WHEN @clear = 1 AND @s = 'approved' THEN N'' ELSE PaymentRejectReason END,
                    ${touch}
              WHERE Id=@id`,
            { id, t: newTotal, pt: previousTotal, diff: difference, s: status, clear: clearPayment }, tx);
    });
    return getOrder(id);
}

/* =========================================================
   User: claim payment (submits UTR)
   ========================================================= */
export async function claimPayment({ id, userId, utr }) {
    if (!utr || String(utr).trim().length < 6) {
        throw new Error("Please enter a valid UTR / Transaction ID (at least 6 characters)");
    }
    await withTransaction(async (tx) => {
        const o = await lockOrder(id, tx);
        if (o.UserId !== userId) throw new Error("Forbidden");
        if (o.Status !== "approved") throw new Error("Order is not in a payable state");

        await query(
            `UPDATE mehndi.Orders
                SET Status='awaiting-verification', PaymentMethod='upi', Utr=@utr,
                    PaymentClaimedAt=SYSUTCDATETIME(), ${touch}
              WHERE Id=@id`,
            { id, utr: String(utr).trim().toUpperCase() }, tx);

        // token numbers are issued as soon as the customer claims payment
        await ensureTokens(o, tx);
    });
    return getOrder(id);
}

/* =========================================================
   Admin: confirm payment (UPI verification, or cash/card at the counter)
   ========================================================= */
export async function confirmPayment({ id, paymentNote }) {
    await withTransaction(async (tx) => {
        const o = await lockOrder(id, tx);
        const isUpiVerification = o.Status === "awaiting-verification";
        const isCounterPayment = o.Status === "approved" && ["cash", "card"].includes(o.PaymentMethod);
        if (!isUpiVerification && !isCounterPayment) throw new Error("Order is not awaiting payment confirmation");

        const total = Number(o.Total) || 0;
        const prevPaid = Number(o.PaidAmount) || 0;
        const paidNow = Math.max(0, total - prevPaid);   // only the outstanding balance
        const newPaid = money(prevPaid + paidNow);

        await query(
            `UPDATE mehndi.Orders
                SET Status='paid', PaidAmount=@paid, PaymentId=@pid, PaidAt=SYSUTCDATETIME(),
                    AdminNote=@note, ${touch}
              WHERE Id=@id`,
            {
                id, paid: newPaid,
                pid: `PAY-${Date.now().toString(36).toUpperCase()}`,
                note: String(paymentNote || o.AdminNote || "").trim(),
            }, tx);

        await ensureTokens(o, tx);
    });
    return getOrder(id);
}

/* ---------- Admin: reject payment ---------- */
export async function rejectPayment({ id, reason }) {
    await withTransaction(async (tx) => {
        const o = await lockOrder(id, tx);
        if (o.Status !== "awaiting-verification") throw new Error("Order is not awaiting verification");
        // paidAmount stays as it was (nothing was actually received)
        await query(
            `UPDATE mehndi.Orders
                SET Status='approved', PaymentRejectReason=@r, PaymentRejectedAt=SYSUTCDATETIME(),
                    Utr=N'', PaymentClaimedAt=NULL, ${touch}
              WHERE Id=@id`,
            { id, r: String(reason || "").trim() }, tx);
    });
    return getOrder(id);
}

/* ---------- Admin: mark a refund as handed back ---------- */
export async function acknowledgeRefund({ id, note }) {
    await withTransaction(async (tx) => {
        const o = await lockOrder(id, tx);
        const total = Number(o.Total) || 0;
        const paid = Number(o.PaidAmount) || 0;
        const refund = Math.max(0, paid - total);
        if (refund <= 0) throw new Error("No refund is pending for this order");

        await query(
            `INSERT INTO mehndi.OrderRefunds (OrderId, Amount, Note) VALUES (@id, @a, @n)`,
            { id, a: refund, n: String(note || "").trim() }, tx);
        await query(
            `UPDATE mehndi.Orders SET PaidAmount=@p, RefundGivenAt=SYSUTCDATETIME(), ${touch} WHERE Id=@id`,
            { id, p: money(paid - refund) }, tx);
    });
    return getOrder(id);
}

/* =========================================================
   Work sessions
   ========================================================= */
export async function startWork({ id }) {
    await withTransaction(async (tx) => {
        const o = await lockOrder(id, tx);
        if (o.IsGroup === true) throw new Error("Use per-member start for group orders");
        if (o.Status !== "paid") throw new Error("Only paid orders can start work");
        await query(
            `UPDATE mehndi.Orders
                SET Status='in-progress', StartedAt=SYSUTCDATETIME(), EndedAt=NULL, DurationSeconds=0, ${touch}
              WHERE Id=@id`, { id }, tx);
    });
    return getOrder(id);
}

export async function endWork({ id, workNote }) {
    await withTransaction(async (tx) => {
        const o = await lockOrder(id, tx);
        if (o.IsGroup === true) throw new Error("Use per-member end for group orders");
        if (o.Status !== "in-progress") throw new Error("Work is not in progress");
        if (!o.StartedAt) throw new Error("Work was never started");

        const now = new Date();
        const seconds = Math.max(1, Math.round((now - new Date(o.StartedAt)) / 1000));
        await query(
            `UPDATE mehndi.Orders
                SET Status='completed', EndedAt=@e, DurationSeconds=@d,
                    WorkNote = CASE WHEN @note IS NULL THEN WorkNote ELSE @note END, ${touch}
              WHERE Id=@id`,
            { id, e: now, d: seconds, note: workNote ? String(workNote).trim() : null }, tx);
    });
    return getOrder(id);
}

export async function startMemberWork({ orderId, memberId }) {
    await withTransaction(async (tx) => {
        const o = await lockOrder(orderId, tx);
        if (o.IsGroup !== true) throw new Error("Not a group order");
        if (o.Status !== "paid" && o.Status !== "in-progress") throw new Error("Payment not confirmed yet");

        const mRows = await query(
            `SELECT * FROM mehndi.OrderMembers WHERE OrderId=@o AND MemberId=@m`, { o: orderId, m: memberId }, tx);
        const m = mRows[0];
        if (!m) throw new Error("Member not found");
        if (m.Status === "in-progress") throw new Error("Member already in progress");
        if (m.Status === "completed") throw new Error("Member already completed");

        await query(
            `UPDATE mehndi.OrderMembers
                SET Status='in-progress', StartedAt=SYSUTCDATETIME(), EndedAt=NULL, DurationSeconds=0
              WHERE OrderId=@o AND MemberId=@m`, { o: orderId, m: memberId }, tx);
        await query(
            `UPDATE mehndi.Orders SET Status = CASE WHEN Status='paid' THEN 'in-progress' ELSE Status END, ${touch}
              WHERE Id=@o`, { o: orderId }, tx);
    });
    return getOrder(orderId);
}

export async function endMemberWork({ orderId, memberId }) {
    await withTransaction(async (tx) => {
        const o = await lockOrder(orderId, tx);
        if (o.IsGroup !== true) throw new Error("Not a group order");

        const mRows = await query(
            `SELECT * FROM mehndi.OrderMembers WHERE OrderId=@o AND MemberId=@m`, { o: orderId, m: memberId }, tx);
        const m = mRows[0];
        if (!m) throw new Error("Member not found");
        if (m.Status !== "in-progress") throw new Error("Member is not in progress");
        if (!m.StartedAt) throw new Error("Never started");

        const now = new Date();
        const seconds = Math.max(1, Math.round((now - new Date(m.StartedAt)) / 1000));
        await query(
            `UPDATE mehndi.OrderMembers SET Status='completed', EndedAt=@e, DurationSeconds=@d
              WHERE OrderId=@o AND MemberId=@m`, { o: orderId, m: memberId, e: now, d: seconds }, tx);

        const open = await query(
            `SELECT COUNT(*) AS N FROM mehndi.OrderMembers WHERE OrderId=@o AND Status <> 'completed'`, { o: orderId }, tx);
        await query(
            `UPDATE mehndi.Orders SET Status = CASE WHEN @open = 0 THEN 'completed' ELSE Status END, ${touch}
              WHERE Id=@o`, { o: orderId, open: open[0].N }, tx);
    });
    return getOrder(orderId);
}

/* =========================================================
   Custom quote negotiation
   ========================================================= */
const addNegotiation = (orderId, by, action, price, note, tx) =>
    query(
        `INSERT INTO mehndi.OrderNegotiations (OrderId, ByRole, Action, Price, Note) VALUES (@o, @by, @a, @p, @n)`,
        { o: orderId, by, a: action, p: price ?? null, n: note ?? null }, tx);

export async function quoteCustomOrder({ id, action, quotedPrice, adminNote }) {
    await withTransaction(async (tx) => {
        const o = await lockOrder(id, tx);
        if (o.Type !== "custom") throw new Error("This is not a custom order");
        const note = String(adminNote || "").trim();

        if (action === "accept") {
            if (!o.SuggestedPrice) throw new Error("Customer hasn't suggested a price");
            await addNegotiation(id, "admin", "accept", Number(o.SuggestedPrice), adminNote || "", tx);
            await query(
                `UPDATE mehndi.Orders SET Status='approved', Total=@p, QuotedPrice=@p, AdminNote=@n, ${touch} WHERE Id=@id`,
                { id, p: Number(o.SuggestedPrice), n: note }, tx);
        } else if (action === "counter") {
            const price = Number(quotedPrice);
            if (!price || price <= 0) throw new Error("Please enter a valid price");
            await addNegotiation(id, "admin", "counter", price, adminNote || "", tx);
            await query(
                `UPDATE mehndi.Orders SET Status='quote-proposed', QuotedPrice=@p, AdminNote=@n, ${touch} WHERE Id=@id`,
                { id, p: price, n: note }, tx);
        } else if (action === "reject") {
            await addNegotiation(id, "admin", "reject", null, adminNote || "", tx);
            await query(
                `UPDATE mehndi.Orders SET Status='rejected', AdminNote=@n, ${touch} WHERE Id=@id`,
                { id, n: String(adminNote || "Custom request declined").trim() }, tx);
        } else {
            throw new Error("Invalid action");
        }
    });
    return getOrder(id);
}

export async function respondToQuote({ id, userId, action }) {
    await withTransaction(async (tx) => {
        const o = await lockOrder(id, tx);
        if (o.UserId !== userId) throw new Error("Forbidden");
        if (o.Type !== "custom") throw new Error("This is not a custom order");
        if (o.Status !== "quote-proposed") throw new Error("No active quote to respond to");

        if (action === "accept") {
            await addNegotiation(id, "customer", "accept", Number(o.QuotedPrice), null, tx);
            await query(`UPDATE mehndi.Orders SET Status='approved', Total=@p, ${touch} WHERE Id=@id`,
                { id, p: Number(o.QuotedPrice) }, tx);
        } else if (action === "decline") {
            await addNegotiation(id, "customer", "decline", Number(o.QuotedPrice), null, tx);
            await query(`UPDATE mehndi.Orders SET Status='custom-pending', AdminNote=N'', ${touch} WHERE Id=@id`, { id }, tx);
        } else {
            throw new Error("Invalid action");
        }
    });
    return getOrder(id);
}
