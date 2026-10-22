import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { getAdminIndustries } from "./services/adminAccess.js";

let io = null;

export function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: { origin: process.env.CLIENT_URL, credentials: true },
    });

    // Optional auth: guests (e.g. the event monitor screen) may connect without a token.
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next();
        try {
            socket.user = jwt.verify(token, process.env.JWT_SECRET);
        } catch { /* ignore bad token → treated as guest */ }
        next();
    });

    io.on("connection", (socket) => {
        const role = socket.user?.role || "GUEST";
        const userId = socket.user?.id;

        console.log(`🔌 ${role} connected: ${socket.id}`);

        // SuperAdmin → "admins" room (sees everything).
        // An Admin only gets alerts for orders on their OWN events, delivered through their private
        // "user:<id>" room - so a UK admin never hears about an India admin's event (and vice versa).
        if (role === "SUPERADMIN") socket.join("admins");
        else if (role === "ADMIN") {
            socket.join("event-owners");
            // + one room per industry the SuperAdmin assigned: normal bookings of those industries alert this admin
            getAdminIndustries(userId).then((keys) => socket.join(keys.map((k) => `industry:${k}`))).catch(() => { });
        }
        else {
            socket.join("users");
            const slug = String(socket.handshake.auth?.slug || "").toLowerCase();
            if (slug) socket.join(`biz:${slug}`);   // alerts of the business the customer is browsing
        }
        if (userId) socket.join(`user:${userId}`);

        socket.on("disconnect", () => console.log(`❌ ${socket.id} left`));
    });

    return io;
}

export function getIO() { return io; }

/** Admin → the customers of ONE business (slug), or every customer when no business is given */
export function notifyUsers(payload, slug) {
    io?.to(slug ? `biz:${slug}` : "users").emit("notification", payload);
}

/** A customer action → the right admins:
 *   - always every SuperAdmin
 *   - an EVENT order → the admin who owns that event
 *   - a NORMAL order → every admin assigned to that order's industry
 *  target = { ownerId, industryKey }  (an order's eventOwnerId / industryKey) */
export function notifyAdmins(target, payload) {
    const { ownerId = null, industryKey = null } = target && typeof target === "object" ? target : { ownerId: target };
    let t = io?.to("admins");
    if (ownerId) t = t?.to(`user:${ownerId}`);
    else if (industryKey) t = t?.to(`industry:${industryKey}`);
    t?.emit("notification", payload);
}

/** After the SuperAdmin changes an admin's industries: move their LIVE sockets between industry rooms. */
export async function syncAdminRooms(adminId, keys) {
    if (!io) return;
    const sockets = await io.in(`user:${adminId}`).fetchSockets();
    for (const s of sockets) {
        for (const room of s.rooms) if (room.startsWith("industry:")) s.leave(room);
        s.join(keys.map((k) => `industry:${k}`));
    }
}

/** Direct message to one user by id */
export function notifyUser(userId, payload) {
    io?.to(`user:${userId}`).emit("notification", payload);
}

/** Kick every live socket of a user (used when an admin is disabled/deleted). */
export function disconnectUser(userId) {
    io?.in(`user:${userId}`).disconnectSockets(true);
}
