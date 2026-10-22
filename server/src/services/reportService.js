import { fetchOrders } from "./orderService.js";
import { adminOrderScope } from "./adminAccess.js";

/* Same numbers/shape the dashboard already expects.
   Orders are filtered in SQL (date range / customer / event), aggregated here. */
export async function buildReport({ from, to, userId, eventId, ownerId }) {
    const where = [];
    const params = {};
    if (from) { where.push("o.UpdatedAt >= @from"); params.from = new Date(from); }
    if (to) { where.push("o.UpdatedAt <= @to"); params.to = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1); }
    if (userId) { where.push("o.UserId = @u"); params.u = userId; }
    if (eventId) { where.push("o.EventId = @e"); params.e = eventId; }
    // an Admin's report only covers THEIR events
    // an Admin's report only covers THEIR industries (and their own events)
    if (ownerId) { where.push(adminOrderScope("o")); params.me = ownerId; }

    const filtered = await fetchOrders({
        where: where.length ? `WHERE ${where.join(" AND ")}` : "",
        params,
    });

    const amountOf = (o) => Number(o.paidAmount) || o.total || 0;
    const revenueEligible = filtered.filter((o) => o.status === "paid" || o.status === "completed");
    const totalRevenue = revenueEligible.reduce((n, o) => n + amountOf(o), 0);

    const completedSessions = filtered.filter((o) => o.status === "completed" && o.durationSeconds > 0);
    const totalSeconds = completedSessions.reduce((n, o) => n + o.durationSeconds, 0);
    const avgSeconds = completedSessions.length ? Math.round(totalSeconds / completedSessions.length) : 0;

    const byDay = {};
    revenueEligible.forEach((o) => {
        const day = new Date(o.paidAt || o.updatedAt || o.createdAt).toISOString().slice(0, 10);
        byDay[day] = (byDay[day] || 0) + amountOf(o);
    });
    const dailyRevenue = Object.entries(byDay)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

    const byUser = {};
    revenueEligible.forEach((o) => {
        if (!byUser[o.userId]) {
            byUser[o.userId] = { userId: o.userId, username: o.username, email: o.email, count: 0, revenue: 0, totalSeconds: 0 };
        }
        byUser[o.userId].count += 1;
        byUser[o.userId].revenue += amountOf(o);
        byUser[o.userId].totalSeconds += o.durationSeconds || 0;
    });
    const topCustomers = Object.values(byUser).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const byDesign = {};
    revenueEligible.forEach((o) => {
        (o.items || []).forEach((it) => {
            if (!byDesign[it.name]) byDesign[it.name] = { name: it.name, qty: 0, revenue: 0 };
            byDesign[it.name].qty += it.qty || 0;
            byDesign[it.name].revenue += (it.qty || 0) * (it.price || 0);
        });
    });
    const topDesigns = Object.values(byDesign).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const eventStats = {};
    filtered.forEach((o) => {
        if (!o.eventId) return;
        if (!eventStats[o.eventId]) eventStats[o.eventId] = { eventId: o.eventId, tokensIssued: 0, paidOrders: 0, revenue: 0 };
        const stat = eventStats[o.eventId];
        if (o.tokenNumber) stat.tokensIssued += 1;
        if (o.isGroup) stat.tokensIssued += (o.members || []).filter((m) => m.tokenNumber).length;
        if (o.status === "paid" || o.status === "completed") {
            stat.paidOrders += 1;
            stat.revenue += amountOf(o);
        }
    });
    const eventSummary = Object.values(eventStats).sort((a, b) => b.tokensIssued - a.tokensIssued);

    const sessions = filtered
        .filter((o) => o.startedAt)
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
        .slice(0, 100);

    return {
        summary: {
            totalRevenue,
            totalOrders: revenueEligible.length,
            totalSessions: completedSessions.length,
            avgSeconds,
            uniqueCustomers: new Set(revenueEligible.map((o) => o.userId)).size,
            inProgressCount: filtered.filter((o) => o.status === "in-progress").length,
        },
        dailyRevenue,
        topCustomers,
        topDesigns,
        eventSummary,
        sessions,
    };
}
