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
                rooms.set(roomId, {
                    users: [],
                    messages: [],
                    phase: 'waiting',
                    timeLeft: 180,
                    vetoedOption: null,
                    timerInterval: null
                });
            }

            const room = rooms.get(roomId);
            room.users.push({ id: socket.id, name: userName, vote: null, isHost: !!isHost, initials: initials || userName.substring(0, 2).toUpperCase() });

            // Send full room state on join
            io.to(roomId).emit("room-update", room.users);
            socket.emit("chat-history", room.messages);
            socket.emit("state-sync", {
                phase: room.phase,
                timeLeft: room.timeLeft,
                vetoedOption: room.vetoedOption
            });
        });

        socket.on("start-voting", ({ roomId }) => {
            const room = rooms.get(roomId);
            if (!room) return;

            room.phase = 'voting';
            io.to(roomId).emit("phase-change", "voting");

            // Start server-side timer if not already running
            if (!room.timerInterval) {
                room.timerInterval = setInterval(() => {
                    if (room.timeLeft > 0) {
                        room.timeLeft -= 1;
                        io.to(roomId).emit("timer-update", room.timeLeft);
                    } else {
                        clearInterval(room.timerInterval);
                        room.timerInterval = null;

                        // Determine winner if no consensus
                        const votes = room.users.map(u => u.vote).filter(v => v !== null);
                        let winner = null;
                        if (votes.length > 0) {
                            const counts = votes.reduce((acc, v) => {
                                acc[v] = (acc[v] || 0) + 1;
                                return acc;
                            }, {});
                            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                            winner = sorted[0][0]; // Most votes
                        }

                        room.phase = 'consensus';
                        io.to(roomId).emit("consensus-reached", winner);
                    }
                }, 1000);
            }
        });

        socket.on("chat-message", ({ roomId, message }) => {
            const room = rooms.get(roomId);
            if (room) {
                room.messages.push(message);
                socket.to(roomId).emit("chat-message", message);
            }
        });

        socket.on("veto-option", ({ roomId, optionTitle }) => {
            const room = rooms.get(roomId);
            if (room) {
                room.vetoedOption = optionTitle;
                // Clear existing votes for this option
                room.users.forEach(u => {
                    if (u.vote === optionTitle) u.vote = null;
                });
                io.to(roomId).emit("veto-applied", optionTitle);
                io.to(roomId).emit("room-update", room.users);
            }
        });

        socket.on("cast-vote", ({ roomId, vote }) => {
            const room = rooms.get(roomId);
            if (!room) return;

            const user = room.users.find((u) => u.id === socket.id);
            if (user) {
                // Prevent voting for vetoed option
                if (vote === room.vetoedOption) return;
                user.vote = vote;
            }

            const allVoted = room.users.every((u) => u.vote !== null);
            const votes = room.users.map((u) => u.vote).filter(v => v !== null);
            const uniqueVotes = new Set(votes);

            io.to(roomId).emit("room-update", room.users);

            if (allVoted && uniqueVotes.size === 1 && room.users.length > 1) {
                clearInterval(room.timerInterval);
                room.timerInterval = null;
                room.phase = 'consensus';
                io.to(roomId).emit("consensus-reached", Array.from(uniqueVotes)[0]);
            }
        });

        socket.on("disconnect", () => {
            rooms.forEach((room, roomId) => {
                const userIndex = room.users.findIndex((u) => u.id === socket.id);
                if (userIndex !== -1) {
                    const wasHost = room.users[userIndex].isHost;
                    room.users.splice(userIndex, 1);

                    if (wasHost || room.users.length === 0) {
                        if (room.timerInterval) clearInterval(room.timerInterval);
                        rooms.delete(roomId);
                        io.to(roomId).emit("room-closed");
                    } else {
                        io.to(roomId).emit("room-update", room.users);
                    }
                }
            });
        });
    });

    httpServer.listen(3000, () => {
        console.log("> HiveMind Active on http://localhost:3000");
    });
});