import { query } from "../db/pool.js";

/* =========================================================
   Slot booking for NORMAL bookings (events are first-come tokens and skip this).
   A booking occupies `stations` units for `minutes` starting at a slot.
   A slot is bookable while  (stations in use during it) + (stations needed) <= total stations.
   ========================================================= */

const pad = (n) => String(n).padStart(2, "0");
const toMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };
const toHHMM = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const label12 = (min) => {
    const h = Math.floor(min / 60), m = min % 60;
    return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function localToday() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const localNowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const weekdayOf = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();
const addDays = (dateStr, n) => new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);

/* ---------- settings ---------- */
function rowToSettings(r) {
    return {
        openTime: r.OpenTime,
        closeTime: r.CloseTime,
        slotMinutes: r.SlotMinutes,
        stations: r.Stations,
        closedDays: r.ClosedDays ? r.ClosedDays.split(",").filter((x) => x !== "").map(Number) : [],
        advanceDays: r.AdvanceDays,
    };
}

export async function getScheduleSettings(db = null) {
    const rows = await query(`SELECT * FROM mehndi.ScheduleSettings WHERE Id = 1`, {}, db);
    return rowToSettings(rows[0]);
}

export async function saveScheduleSettings(input) {
    const openTime = String(input.openTime || "");
    const closeTime = String(input.closeTime || "");
    if (!/^\d{2}:\d{2}$/.test(openTime) || !/^\d{2}:\d{2}$/.test(closeTime)) throw new Error("Opening and closing time are required (HH:MM)");
    if (toMin(closeTime) <= toMin(openTime)) throw new Error("Closing time must be after opening time");

    const slotMinutes = Number(input.slotMinutes);
    if (![10, 15, 20, 30, 45, 60].includes(slotMinutes)) throw new Error("Slot length must be 10, 15, 20, 30, 45 or 60 minutes");
    const stations = Number(input.stations);
    if (!Number.isInteger(stations) || stations < 1 || stations > 50) throw new Error("Stations must be between 1 and 50");
    const advanceDays = Number(input.advanceDays);
    if (!Number.isInteger(advanceDays) || advanceDays < 1 || advanceDays > 365) throw new Error("Advance booking must be 1-365 days");
    const closed = [...new Set((input.closedDays || []).map(Number))].filter((d) => d >= 0 && d <= 6).sort();

    await query(
        `UPDATE mehndi.ScheduleSettings
            SET OpenTime=@o, CloseTime=@c, SlotMinutes=@s, Stations=@st, ClosedDays=@cd, AdvanceDays=@a, UpdatedAt=SYSUTCDATETIME()
          WHERE Id = 1`,
        { o: openTime, c: closeTime, s: slotMinutes, st: stations, cd: closed.join(","), a: advanceDays });
    return getScheduleSettings();
}

/* ---------- how long does a booking take, and how many stations does it need? ---------- */
/**
 * single order : sum(qty x duration of each item), 1 station
 * group order  : members are served at the same time on as many stations as are free
 *                (up to the number of members); extra members wait for the next round.
 */
export function planBooking({ isGroup, items, members }, stationsTotal) {
    const sum = (list) => (list || []).reduce((n, i) => n + (Number(i.qty) || 1) * (Number(i.durationMinutes) || 60), 0);
    if (isGroup) {
        const lengths = (members || []).map((m) => sum(m.items));
        const need = Math.max(1, Math.min(lengths.length, stationsTotal));
        const rounds = Math.ceil(lengths.length / need);
        return { minutes: Math.max(15, rounds * Math.max(...lengths, 15)), stations: need };
    }
    return { minutes: Math.max(15, sum(items)), stations: 1 };
}

/** Durations of catalogue designs (for the slot picker, before an order exists). */
export async function loadDurations(ids) {
    const unique = [...new Set(ids.map(String))].slice(0, 200);
    if (!unique.length) return new Map();
    const params = {};
    unique.forEach((id, i) => { params[`d${i}`] = id; });
    const rows = await query(
        `SELECT Id, DurationMinutes FROM mehndi.Designs WHERE Id IN (${unique.map((_, i) => `@d${i}`).join(",")})`, params);
    return new Map(rows.map((r) => [r.Id, r.DurationMinutes]));
}

/* ---------- availability ---------- */
async function dayBookings(dateStr, excludeOrderId, db) {
    return query(
        `SELECT SlotStartMin, SlotMinutes, SlotStations FROM mehndi.Orders
          WHERE SlotDate = @d AND EventId IS NULL AND Status <> 'rejected'
            AND SlotMinutes IS NOT NULL ${excludeOrderId ? "AND Id <> @ex" : ""}`,
        excludeOrderId ? { d: dateStr, ex: excludeOrderId } : { d: dateStr }, db);
}

/* Free stations = total - the PEAK number in use at any instant inside [start, start+minutes).
   (Summing every overlapping booking would wrongly block e.g. a slot between two back-to-back ones.) */
function freeStationsAt(bookings, start, minutes, total) {
    const end = start + minutes;
    const overlapping = bookings.filter((b) => b.SlotStartMin < end && b.SlotStartMin + b.SlotMinutes > start);
    const checkPoints = [start, ...overlapping.map((b) => b.SlotStartMin).filter((t) => t > start && t < end)];
    let peak = 0;
    for (const t of checkPoints) {
        const inUse = overlapping
            .filter((b) => b.SlotStartMin <= t && b.SlotStartMin + b.SlotMinutes > t)
            .reduce((n, b) => n + (b.SlotStations || 1), 0);
        peak = Math.max(peak, inUse);
    }
    return total - peak;
}

function dayState(dateStr, s) {
    const today = localToday();
    if (!DATE_RE.test(dateStr || "")) return { ok: false, reason: "Please choose a valid date" };
    if (dateStr < today) return { ok: false, reason: "That date has already passed" };
    if (dateStr > addDays(today, s.advanceDays)) return { ok: false, reason: `Bookings open ${s.advanceDays} days ahead` };
    if (s.closedDays.includes(weekdayOf(dateStr))) return { ok: false, reason: "We are closed on this day", closed: true };
    return { ok: true };
}

/** All start times for a day with how many stations are still free. */
export async function getSlots({ date, minutes, stations }) {
    const s = await getScheduleSettings();
    const need = Math.min(stations, s.stations);
    const state = dayState(date, s);
    if (!state.ok) return { ...state, slots: [], settings: s };

    const bookings = await dayBookings(date, null, null);
    const open = toMin(s.openTime), close = toMin(s.closeTime);
    const isToday = date === localToday();
    const nowMin = localNowMin();

    const slots = [];
    for (let start = open; start + minutes <= close; start += s.slotMinutes) {
        const free = freeStationsAt(bookings, start, minutes, s.stations);
        slots.push({
            time: toHHMM(start),
            label: label12(start),
            available: !(isToday && start <= nowMin) && free >= need,
        });
    }
    return { ok: true, minutes, stations: need, slots, settings: s };
}

/**
 * Serialises bookings per day (application lock), then confirms the slot is still free.
 * Call INSIDE the transaction that inserts / updates the order.
 */
export async function reserveSlot({ date, time, minutes, stations, excludeOrderId, keepPast = false }, tx) {
    const s = await getScheduleSettings(tx);
    if (!keepPast) {
        const state = dayState(date, s);
        if (!state.ok) throw new Error(state.reason);
    }

    // sp_getapplock works on every SQL Server version (incl. 2008 R2)
    const lock = await query(
        `DECLARE @r INT;
         EXEC @r = sp_getapplock @Resource = @res, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
         SELECT @r AS R;`,
        { res: `mehndi-slot-${date}` }, tx);
    if ((lock[0]?.R ?? -1) < 0) throw new Error("The studio is busy right now. Please try again in a moment.");

    if (!/^\d{2}:\d{2}$/.test(String(time || ""))) throw new Error("Please choose a time slot");
    const start = toMin(time);
    const need = Math.min(stations, s.stations);
    const open = toMin(s.openTime), close = toMin(s.closeTime);

    if (start < open || start + minutes > close) throw new Error(`That booking needs ${minutes} minutes and must finish by ${label12(close)}`);
    if ((start - open) % s.slotMinutes !== 0) throw new Error("Please choose one of the listed time slots");
    if (!keepPast && date === localToday() && start <= localNowMin()) throw new Error("That time has already passed");

    const bookings = await dayBookings(date, excludeOrderId, tx);
    if (freeStationsAt(bookings, start, minutes, s.stations) < need) {
        throw new Error("Sorry, that time slot was just taken. Please choose another.");
    }
    return { date, startMin: start, minutes, stations: need };
}
