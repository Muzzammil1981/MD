import express from "express";
import { requireAuth, requireAdmin, isAdminRole } from "../middleware/auth.js";
import {
    createOrder, listOrders, getOrder, updateOrderStatus,
    claimPayment, confirmPayment, rejectPayment, setPaymentMethod,
    updateOrderItems, quoteCustomOrder, respondToQuote,
    startWork, endWork, startMemberWork, endMemberWork, acknowledgeRefund, adminCanAccessOrder,
} from "../services/orderService.js";
import { getSettingsForOrder, generateDynamicQr } from "../services/settingsService.js";
import { notifyAdmins, notifyUser } from "../socket.js";
import { getProfile, cap } from "../config/industries.js";

const router = express.Router();
const now = () => new Date().toISOString();
const bad = (res, err) => res.status(400).json({ message: err.message });

/* Admin-only actions on an order: an Admin may only touch orders of THEIR events. */
async function ownsOrder(req, res, next) {
    try {
        const { found, allowed } = await adminCanAccessOrder(req.user, req.params.id);
        if (!found) return res.status(404).json({ message: "Order not found" });
        if (!allowed) return res.status(403).json({ message: "This order belongs to another admin's event" });
        next();
    } catch (err) { res.status(500).json({ message: err.message }); }
}
const adminOrder = [requireAuth, requireAdmin, ownsOrder];

/* ---------- Create order ---------- */
router.post("/", requireAuth, async (req, res) => {
    try {
        const { items, requestedDate, requestedTime, notes, eventId, paymentMethod, isGroup, members } = req.body || {};
        const order = await createOrder({
            user: req.user,
            items: items || [],
            requestedDate, requestedTime, notes, eventId,
            status: eventId ? "approved" : "pending",
            paymentMethod: paymentMethod || "upi",
            isGroup: Boolean(isGroup),
            members: members || [],
        });
        notifyAdmins({ ownerId: order.eventOwnerId, industryKey: order.industryKey }, {
            type: "new-order",
            title: isGroup
                ? `New group booking (${order.members.length} people)`
                : (eventId ? "New Event Order (Auto-Approved)" : "New appointment request"),
            body: `${order.username} requested ${order.requestedDate} at ${order.requestedTime}`,
            orderId: order.id,
            at: now(),
        });
        res.status(201).json(order);
    } catch (err) { bad(res, err); }
});

/* ---------- Custom order ---------- */
router.post("/custom", requireAuth, async (req, res) => {
    try {
        const {
            customDescription, customImageId, customImage, suggestedPrice,
            requestedDate, requestedTime, notes, eventId, paymentMethod,
        } = req.body || {};
        const order = await createOrder({
            user: req.user,
            items: [],
            type: "custom",
            customDescription, customImageId, customImage, suggestedPrice,
            requestedDate, requestedTime, notes, eventId,
            status: "custom-pending",
            paymentMethod: paymentMethod || "upi",
        });
        notifyAdmins({ ownerId: order.eventOwnerId, industryKey: order.industryKey }, {
            type: "new-order",
            title: `🎨 Custom request · suggested £${order.suggestedPrice}`,
            body: `${order.username} wants a custom design. Review and respond.`,
            orderId: order.id,
            at: now(),
        });
        res.status(201).json(order);
    } catch (err) { bad(res, err); }
});

/* ---------- List / single ---------- */
router.get("/", requireAuth, async (req, res) => {
    try { res.json(await listOrders({ userId: req.user.id, role: req.user.role })); }
    catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id", requireAuth, async (req, res) => {
    try {
        const order = await getOrder(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (isAdminRole(req.user.role)) {
            const { allowed } = await adminCanAccessOrder(req.user, order.id);
            if (!allowed) return res.status(403).json({ message: "Forbidden" });
        } else if (order.userId !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        res.json(order);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ---------- Dynamic UPI QR - charges ONLY the current balance due ---------- */
router.get("/:id/qr", requireAuth, async (req, res) => {
    try {
        const order = await getOrder(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.userId !== req.user.id) return res.status(403).json({ message: "Forbidden" });
        if (order.status !== "approved") return res.status(400).json({ message: "Order is not payable" });

        const amountDue = Number(order.balanceDue) > 0 ? Number(order.balanceDue) : Number(order.total);

        const settings = await getSettingsForOrder(order);
        if (!settings.upiId) return res.status(400).json({ message: "UPI is not set up for this event. Please choose cash/card at the counter." });

        const { uri, dataUrl } = await generateDynamicQr({
            upiId: settings.upiId,
            merchantName: settings.merchantName || getProfile().name,
            amount: amountDue,
            note: `${getProfile().name.split(" ")[0]} Order ${order.id.slice(0, 8)}`,
            txnRef: `MEH${order.id.slice(0, 8).toUpperCase()}`,
        });

        res.json({
            uri, qrCodeDataUrl: dataUrl,
            upiId: settings.upiId,
            merchantName: settings.merchantName,
            amount: amountDue,
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ---------- Payment method ---------- */
router.patch("/:id/payment-method", requireAuth, async (req, res) => {
    try {
        const { method } = req.body || {};
        const order = await setPaymentMethod({ id: req.params.id, userId: req.user.id, method });
        notifyAdmins({ ownerId: order.eventOwnerId, industryKey: order.industryKey }, {
            type: "order-update",
            title: method === "cash" ? `💵 Customer will pay cash at counter` : `💳 Customer will pay by card at counter`,
            body: `${order.username} · Order #${order.id.slice(0, 8)} - confirm at counter when they arrive.`,
            orderId: order.id,
            at: now(),
        });
        res.json(order);
    } catch (err) { bad(res, err); }
});

/* ---------- Admin approve / reject / reschedule ---------- */
router.patch("/:id/status", ...adminOrder, async (req, res) => {
    try {
        const { status, adminNote, proposedDate, proposedTime } = req.body || {};
        const order = await updateOrderStatus({ id: req.params.id, status, adminNote, proposedDate, proposedTime });
        notifyUser(order.userId, {
            type: "order-update",
            title: status === "approved" ? "Your appointment is confirmed ✓" : "Your appointment was declined",
            body: status === "approved"
                ? `${order.proposedDate || order.requestedDate} at ${order.proposedTime || order.requestedTime}`
                : adminNote || "Please try booking another slot.",
            orderId: order.id,
            status,
            at: now(),
        });
        res.json(order);
    } catch (err) { bad(res, err); }
});

/* ---------- Modify items - notification reflects top-up vs. refund ---------- */
router.patch("/:id/items", requireAuth, async (req, res) => {
    try {
        const order = await updateOrderItems({ id: req.params.id, userId: req.user.id, items: req.body?.items });

        const balance = Number(order.balanceDue) || 0;
        const refund = Number(order.refundDue) || 0;
        const summaryLabel =
            refund > 0 ? `-£${refund.toFixed(2)} (refund due)`
                : balance > 0 ? `+£${balance.toFixed(2)} (top-up)`
                    : "no charge";

        notifyAdmins({ ownerId: order.eventOwnerId, industryKey: order.industryKey }, {
            type: "order-update",
            title: `✏️ Order modified (${summaryLabel})`,
            body: `${order.username} changed ${getProfile().items} for Order #${order.id.slice(0, 8)}`,
            orderId: order.id,
            at: now(),
        });
        notifyUser(order.userId, {
            type: "order-update",
            title: "Order updated",
            body:
                refund > 0 ? `£${refund.toFixed(2)} will be refunded to you.`
                    : balance > 0 ? `Please pay the remaining £${balance.toFixed(2)}.`
                        : "Your changes have been saved.",
            orderId: order.id,
            status: order.status,
            at: now(),
        });
        res.json(order);
    } catch (err) { bad(res, err); }
});

/* ---------- Claim payment (customer submits UTR; tokens are issued here) ---------- */
router.post("/:id/claim-payment", requireAuth, async (req, res) => {
    try {
        const order = await claimPayment({ id: req.params.id, userId: req.user.id, utr: req.body?.utr });
        const tokens = order.isGroup ? order.members.map((m) => m.tokenNumber).filter(Boolean) : [];

        notifyAdmins({ ownerId: order.eventOwnerId, industryKey: order.industryKey }, {
            type: "payment-claim",
            title: order.isGroup
                ? `Group payment claimed · ${order.members.length} tokens`
                : `Payment claimed - verify ⏳`,
            body: order.isGroup
                ? `${order.username} paid £${order.total} · Tokens ${tokens.map((t) => `#${t}`).join(", ")}`
                : `${order.username} paid £${order.balanceDue || order.total} · UTR: ${order.utr}`,
            orderId: order.id,
            at: now(),
        });
        res.json(order);
    } catch (err) { bad(res, err); }
});

/* ---------- Admin confirms payment (UPI or cash/card at the counter) ---------- */
router.post("/:id/confirm-payment", ...adminOrder, async (req, res) => {
    try {
        const order = await confirmPayment({ id: req.params.id, paymentNote: req.body?.note });
        notifyUser(order.userId, {
            type: "order-update",
            title: "Payment verified ✓",
            body: order.isGroup
                ? `Your group of ${order.members.length} is confirmed. Tokens: ${order.members.map((m) => `#${m.tokenNumber}`).join(", ")}`
                : `Thanks! Your appointment is confirmed. Ref: ${order.paymentId}`,
            orderId: order.id,
            status: "paid",
            at: now(),
        });
        res.json(order);
    } catch (err) { bad(res, err); }
});

/* ---------- Admin rejects payment ---------- */
router.post("/:id/reject-payment", ...adminOrder, async (req, res) => {
    try {
        const order = await rejectPayment({ id: req.params.id, reason: req.body?.reason });
        notifyUser(order.userId, {
            type: "order-update",
            title: "Payment not received",
            body: order.paymentRejectReason || "We couldn't match your payment. Please try again.",
            orderId: order.id,
            status: "approved",
            at: now(),
        });
        res.json(order);
    } catch (err) { bad(res, err); }
});

/* ---------- Admin: mark refund as given ---------- */
router.post("/:id/acknowledge-refund", ...adminOrder, async (req, res) => {
    try {
        const order = await acknowledgeRefund({ id: req.params.id, note: req.body?.note });
        notifyUser(order.userId, {
            type: "order-update",
            title: "Refund issued",
            body: "The studio has processed your refund. It should reach you shortly.",
            orderId: order.id,
            status: order.status,
            at: now(),
        });
        res.json(order);
    } catch (err) { bad(res, err); }
});

/* ---------- Start / end work ---------- */
router.post("/:id/start-work", ...adminOrder, async (req, res) => {
    try {
        const order = await startWork({ id: req.params.id });
        notifyUser(order.userId, {
            type: "order-update",
            title: getProfile().startedTitle,
            body: "The studio has started working on your design.",
            orderId: order.id, status: "in-progress", startedAt: order.startedAt,
            at: now(),
        });
        res.json(order);
    } catch (err) { bad(res, err); }
});

router.post("/:id/end-work", ...adminOrder, async (req, res) => {
    try {
        const order = await endWork({ id: req.params.id, workNote: req.body?.note });
        notifyUser(order.userId, {
            type: "order-update",
            title: getProfile().readyTitle,
            body: `Thanks for choosing ${getProfile().name}. Total time: ${Math.round(order.durationSeconds / 60)} minutes.`,
            orderId: order.id, status: "completed", durationSeconds: order.durationSeconds,
            at: now(),
        });
        notifyAdmins({ ownerId: order.eventOwnerId, industryKey: order.industryKey }, {
            type: "order-completed",
            title: "Session completed ✅",
            body: `${order.username} · ${Math.round(order.durationSeconds / 60)} min`,
            orderId: order.id,
            at: now(),
        });
        res.json(order);
    } catch (err) { bad(res, err); }
});

/* ---------- Group member start / end ---------- */
router.post("/:id/members/:memberId/start", ...adminOrder, async (req, res) => {
    try {
        const order = await startMemberWork({ orderId: req.params.id, memberId: req.params.memberId });
        const m = order.members.find((x) => x.memberId === req.params.memberId);
        notifyUser(order.userId, {
            type: "order-update",
            title: `Session started for ${m.name} ✨`,
            body: m.tokenNumber ? `Token #${m.tokenNumber}` : "",
            orderId: order.id, status: "in-progress", startedAt: m.startedAt,
            at: now(),
        });
        res.json(order);
    } catch (err) { bad(res, err); }
});

router.post("/:id/members/:memberId/end", ...adminOrder, async (req, res) => {
    try {
        const order = await endMemberWork({ orderId: req.params.id, memberId: req.params.memberId });
        const m = order.members.find((x) => x.memberId === req.params.memberId);
        notifyUser(order.userId, {
            type: "order-update",
            title: `${m.name} is ready! 🎨`,
            body: `Total time: ${Math.round(m.durationSeconds / 60)} min.`,
            orderId: order.id, status: "completed", durationSeconds: m.durationSeconds,
            at: now(),
        });
        res.json(order);
    } catch (err) { bad(res, err); }
});

/* ---------- Custom quote flow ---------- */
router.patch("/:id/quote", ...adminOrder, async (req, res) => {
    try {
        const { action, quotedPrice, adminNote } = req.body || {};
        const order = await quoteCustomOrder({ id: req.params.id, action, quotedPrice, adminNote });
        let title = "", body = "";
        if (action === "accept") {
            title = `Quote accepted at £${order.total}`;
            body = `Your ${getProfile().customRequest} has been confirmed. Open My Orders to pay.`;
        } else if (action === "counter") {
            title = `New price proposed: £${order.quotedPrice}`;
            body = adminNote || "Review the counter-offer in My Orders.";
        } else {
            title = `${cap(getProfile().customRequest)} declined`;
            body = adminNote || "Please try a different design.";
        }
        notifyUser(order.userId, { type: "order-update", title, body, orderId: order.id, status: order.status, at: now() });
        res.json(order);
    } catch (err) { bad(res, err); }
});

router.patch("/:id/quote-response", requireAuth, async (req, res) => {
    try {
        const { action } = req.body || {};
        const order = await respondToQuote({ id: req.params.id, userId: req.user.id, action });
        notifyAdmins({ ownerId: order.eventOwnerId, industryKey: order.industryKey }, {
            type: "order-update",
            title: action === "accept" ? `✅ Quote accepted · £${order.total}` : `❌ Counter-offer declined`,
            body: action === "accept"
                ? `${order.username} accepted. Awaiting payment.`
                : `${order.username} declined. Review and send a new price.`,
            orderId: order.id,
            at: now(),
        });
        res.json(order);
    } catch (err) { bad(res, err); }
});

export default router;
