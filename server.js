// @ts-nocheck
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer(handle);
    const io = new Server(httpServer);

    const rooms = new Map();

    io.on("connection", (socket) => {
        socket.on("check-room-code", ({ roomId }, callback) => {
            if (rooms.has(roomId)) {
                callback({ isTaken: true });
            } else {
                callback({ isTaken: false });
            }
        });

        socket.on("join-room", ({ roomId, userName, isHost, initials }) => {
            socket.join(roomId);

            if (!rooms.has(roomId)) {
                rooms.set(roomId, { users: [] });
            }

            const room = rooms.get(roomId);
            room.users.push({ id: socket.id, name: userName, vote: null, isHost: !!isHost, initials: initials || userName.substring(0, 2).toUpperCase() });

            io.to(roomId).emit("room-update", room.users);
        });

        socket.on("start-voting", ({ roomId }) => {
            io.to(roomId).emit("phase-change", "voting");
        });

        socket.on("chat-message", ({ roomId, message }) => {
            // broadcast to everyone in the room (including sender, or sender can render locally and use socket.broadcast)
            // Here we use broadcast to send to others
            socket.to(roomId).emit("chat-message", message);
        });

        socket.on("cast-vote", ({ roomId, vote }) => {
            const room = rooms.get(roomId);
            if (!room) return;

            const user = room.users.find((u) => u.id === socket.id);
            if (user) user.vote = vote;

            const allVoted = room.users.every((u) => u.vote !== null);
            const uniqueVotes = new Set(room.users.map((u) => u.vote));

            io.to(roomId).emit("room-update", room.users);

            if (allVoted && uniqueVotes.size === 1 && room.users.length > 1) {
                io.to(roomId).emit("consensus-reached", Array.from(uniqueVotes)[0]);
            }
        });

        socket.on("disconnect", () => {
            rooms.forEach((room, roomId) => {
                room.users = room.users.filter((u) => u.id !== socket.id);
                io.to(roomId).emit("room-update", room.users);
            });
        });
    });

    httpServer.listen(3000, () => {
        console.log("> HiveMind Active on http://localhost:3000");
    });
});