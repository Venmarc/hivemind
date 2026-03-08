"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { useHiveStore, HiveUser } from '../store/useHiveStore';
import { LogOut, Users, CheckCircle2, Clock, Copy, Hexagon, X, MessageSquare, Plus } from 'lucide-react';

let socket: Socket;

// --- Mock Data ---
const MOCK_OPTIONS = [
  { id: "opt-1", title: "Option A", desc: "Deploy new AI model" },
  { id: "opt-2", title: "Option B", desc: "Refactor backend" },
  { id: "opt-3", title: "Option C", desc: "Update UI theme" },
];

type AppPhase = 'home' | 'waiting' | 'voting' | 'consensus';

type ExtendedUser = HiveUser & { isHost?: boolean; initials: string };

export default function HiveMindApp() {
  const { users, consensus, setUsers, setConsensus, reset } = useHiveStore();

  // App Phase & State
  const [phase, setPhase] = useState<AppPhase>('home');
  const [myName, setMyName] = useState("");
  const [myVote, setMyVote] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);

  // Room State
  const [roomCode, setRoomCode] = useState("");
  const [timeLeft, setTimeLeft] = useState(180);

  // UI States
  const [showToast, setShowToast] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  // Veto States (Server-synced)
  const [hasVetoed, setHasVetoed] = useState(false);
  const [vetoedOption, setVetoedOption] = useState<string | null>(null);

  // Chat States
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<{ id: number; text: string; sender: string; isMe: boolean; initials: string; time: string }[]>([]);

  // --- Utilities ---
  const leaveHive = useCallback(() => {
    reset();
    setPhase('home');
    setMyVote(null);
    setIsHost(false);
    setMyName("");
    setHasVetoed(false);
    setVetoedOption(null);
    setRoomCode("");
    setMessages([]);
    setTimeLeft(180);
  }, [reset]);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  // --- Real-time Hooks ---
  useEffect(() => {
    socket = io();
    socket.on("room-update", (updatedUsers: HiveUser[]) => setUsers(updatedUsers));
    socket.on("consensus-reached", (winner: string) => {
      setConsensus(winner);
      setPhase('consensus');
    });
    socket.on("phase-change", (newPhase: AppPhase) => {
      setPhase(newPhase);
    });
    socket.on("chat-message", (msg) => {
      setMessages(prev => [...prev, msg]);
    });
    socket.on("chat-history", (history) => {
      setMessages(history);
    });
    socket.on("state-sync", (state) => {
      setPhase(state.phase);
      setTimeLeft(state.timeLeft);
      setVetoedOption(state.vetoedOption);
    });
    socket.on("timer-update", (newTime) => {
      setTimeLeft(newTime);
    });
    socket.on("timer-expired", () => {
      // Server now sends consensus-reached with winner, but keeping this as backup
      setPhase('consensus');
    });
    socket.on("veto-applied", (optionTitle) => {
      setVetoedOption(optionTitle);
      // Local state update: if I was voting for this, clear it
      setMyVote(prev => prev === optionTitle ? null : prev);
    });
    socket.on("room-closed", () => {
      alert("The host has left or the room was closed.");
      leaveHive();
    });
    return () => { socket.disconnect(); };
  }, [setUsers, setConsensus, leaveHive]);



  // --- User Merging ---
  // The global store holds the canonical `users` array sent by Socket.io from the backend server.
  const displayUsers: ExtendedUser[] = phase === 'home' ? [] : users.map(u => ({
    ...u,
    initials: u.initials || u.name.substring(0, 2).toUpperCase()
  }));

  const MAX_USERS = 10;
  const allVoted = displayUsers.length > 0 && displayUsers.every(u => u.vote !== null);

  // --- Actions ---
  const handleCreateRoom = async () => {
    if (!myName.trim()) return alert("Enter your name");
    setIsHost(true);

    let newRoomCode = "";
    let isTaken = true;

    // Loop until we find a unique room code
    while (isTaken) {
      newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      isTaken = await new Promise((resolve) => {
        socket.emit("check-room-code", { roomId: newRoomCode }, (response: { isTaken: boolean }) => {
          resolve(response.isTaken);
        });
      });
    }

    setRoomCode(newRoomCode);
    setPhase('waiting');
    socket.emit("join-room", { roomId: newRoomCode, userName: myName, isHost: true, initials: myName.substring(0, 2).toUpperCase() });
  };

  const handleJoinRoom = () => {
    if (!myName.trim()) return alert("Enter your name");
    if (!joinCode.trim()) return alert("Enter room code");
    setIsHost(false);
    const code = joinCode.toUpperCase();
    setRoomCode(code);
    setPhase('waiting');
    socket.emit("join-room", { roomId: code, userName: myName, isHost: false, initials: myName.substring(0, 2).toUpperCase() });
  };

  const startVoting = () => {
    setPhase('voting');
    socket.emit("start-voting", { roomId: roomCode });
  };

  const handleVeto = (e: React.MouseEvent, title: string) => {
    e.stopPropagation();
    if (hasVetoed) return;
    if (window.confirm("Veto this option? (one-time use)")) {
      setHasVetoed(true);
      setVetoedOption(title);
      socket.emit("veto-option", { roomId: roomCode, optionTitle: title });
      if (myVote === title) setMyVote(null);
    }
  };

  // --- Render Functions ---

  const renderToast = () => (
    <AnimatePresence>
      {showToast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-hive-yellow-base text-black px-6 py-2 rounded-full font-bold shadow-[0_0_15px_#ffdd00]"
        >
          Copied!
        </motion.div>
      )}
    </AnimatePresence>
  );

  const HoneycombLoader = () => (
    <div className="relative w-16 h-16 flex items-center justify-center animate-[spin_4s_linear_infinite] mb-6">
      <Hexagon size={64} strokeWidth={1} className="absolute text-hive-yellow-base drop-shadow-[0_0_8px_rgba(255,221,0,0.6)] opacity-70" />
      <Hexagon size={32} fill="currentColor" strokeWidth={0} className="absolute text-hive-yellow-neon animate-[pulse_1.5s_infinite] drop-shadow-[0_0_10px_rgba(255,234,0,0.8)]" />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <div key={deg} className="absolute inset-0 text-hive-yellow-base/30" style={{ transform: `rotate(${deg}deg)` }}>
          <Hexagon size={48} strokeWidth={0.5} className="-translate-y-7" />
        </div>
      ))}
    </div>
  );

  const renderSyncedModal = () => (
    <AnimatePresence>
      {showModal && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-hive-card border border-hive-yellow-base/30 rounded-2xl p-6 w-[90%] max-w-sm shadow-[0_0_30px_rgba(255,221,0,0.15)]"
          >
            <div className="flex justify-between items-center mb-6 border-b border-hive-yellow-base/20 pb-4">
              <h2 className="text-xl font-bold text-hive-yellow-neon flex items-center gap-2">
                <Users size={20} /> Hive Minds
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {displayUsers.map(u => {
                const isMe = u.id === socket?.id;
                return (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-black/30 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-10 h-10 flex items-center justify-center rounded-full font-bold border-2
                        ${isMe ? 'border-hive-yellow-neon text-hive-yellow-neon shadow-[0_0_8px_rgba(255,234,0,0.6)]' :
                          u.vote ? 'border-hive-green-neon text-hive-green-neon' : 'border-hive-yellow-base text-hive-yellow-base'}
                      `}>
                        {u.initials}
                      </div>
                      <div>
                        <p className={`font-bold text-white flex items-center gap-2 ${isMe ? 'text-lg text-hive-yellow-neon drop-shadow-md' : ''}`}>
                          {u.name}
                          {isMe && <span className="text-[10px] bg-hive-yellow-base text-black px-2 py-0.5 rounded font-black uppercase">You</span>}
                          {u.isHost && <span className="text-[10px] bg-hive-red-neon text-white px-2 py-0.5 rounded font-black tracking-widest uppercase shadow-[0_0_5px_#ff0033]">Host</span>}
                        </p>
                        <p className="text-xs text-gray-400">
                          {phase === 'voting' ? (u.vote ? 'Vote locked' : 'Deciding...') : 'Ready'}
                        </p>
                      </div>
                    </div>
                    {phase === 'voting' && (
                      <div className={`w-3 h-3 rounded-full ${u.vote ? 'bg-hive-green-neon shadow-[0_0_8px_#39ff14]' : 'bg-hive-red-neon shadow-[0_0_8px_#ff0033]'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  const renderHeader = () => (
    <nav className="flex justify-between items-center p-4 md:p-6 border-b border-hive-yellow-base/10 bg-hive-card/50 backdrop-blur-md sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-hive-red-neon font-black text-2xl tracking-tighter drop-shadow-[0_0_8px_rgba(255,0,51,0.6)]">
          <Hexagon className="text-hive-red-neon" fill="currentColor" size={28} />
          HM
        </div>
        <button
          onClick={copyRoomCode}
          className="px-3 py-1 bg-black/50 rounded-md border border-hive-yellow-base/20 flex items-center gap-2 text-sm text-hive-yellow-base hover:bg-hive-yellow-base/10 hover:border-hive-yellow-base/50 transition-all font-mono shadow-[0_0_10px_rgba(255,221,0,0.1)] hover:shadow-[0_0_15px_rgba(255,221,0,0.3)]"
        >
          Room: {roomCode}
          <Copy size={14} />
        </button>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-black/50 px-3 md:px-4 py-1.5 rounded-full border border-hive-green-neon/30 hover:border-hive-green-neon/80 transition-all cursor-pointer shadow-[0_0_10px_rgba(57,255,20,0.1)] hover:shadow-[0_0_15px_rgba(57,255,20,0.3)]"
        >
          <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-hive-green-neon shadow-[0_0_8px_#39ff14] animate-pulse" />
          <span className="font-mono text-xs md:text-sm text-hive-green-neon font-bold whitespace-nowrap">
            {displayUsers.length} Synced
          </span>
        </button>

        <button
          onClick={leaveHive}
          className="text-sm font-semibold text-gray-400 hover:text-hive-red-neon transition-colors flex items-center gap-2"
        >
          <span className="hidden sm:inline">Leave Hive</span>
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );

  const renderSidebar = () => {
    const handleSendMessage = (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!chatMessage.trim()) return;

      const newMsg = {
        id: Date.now(),
        text: chatMessage,
        sender: myName || "Me",
        isMe: true, // Local render
        initials: myName.substring(0, 2).toUpperCase() || "ME",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages([...messages, newMsg]);
      setChatMessage("");

      // Broadcast to others (server will set isMe false for recipients via our payload tweak)
      socket.emit("chat-message", {
        roomId: roomCode,
        message: { ...newMsg, isMe: false }
      });
    };

    return (
      <>
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
            />
          )}
        </AnimatePresence>

        <div className={`
          fixed top-0 md:top-[73px] bottom-0 right-0 
          w-full md:w-80 lg:w-96 bg-hive-card 
          border-l border-hive-yellow-base/10 
          transform transition-transform duration-300 z-40 flex flex-col
          shadow-[-10px_0_30px_rgba(0,0,0,0.5)]
          ${showSidebar ? 'translate-x-0' : 'translate-x-full'}
        `}>
          <div className="p-4 border-b border-hive-yellow-base/20 flex items-center justify-between bg-hive-card/80 backdrop-blur">
            <h3 className="font-bold text-hive-yellow-base flex items-center gap-2 drop-shadow-[0_0_5px_rgba(255,221,0,0.3)]">
              <Hexagon size={18} fill="currentColor" className="text-hive-yellow-neon animate-pulse" /> Hive Chat
            </h3>
            <button onClick={() => setShowSidebar(false)} className="text-gray-400 hover:text-hive-red-neon transition-colors p-1 rounded-full hover:bg-white/5">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 scrollbar-thin scrollbar-thumb-hive-red-neon/30 hover:scrollbar-thumb-hive-red-neon/50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 max-w-[85%] ${msg.isMe ? 'self-end flex-row-reverse' : 'self-start'}`}>
                <div className={`
                  w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold border
                  ${msg.isMe ? 'bg-hive-yellow-base/10 border-hive-yellow-base text-hive-yellow-base' : 'bg-black/50 border-white/20 text-gray-300'}
                `}>
                  {msg.initials}
                </div>
                <div className="flex flex-col">
                  <div className={`flex items-baseline gap-2 mb-1 ${msg.isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className={`text-[10px] uppercase tracking-wider font-bold ${msg.isMe ? 'text-hive-yellow-base' : 'text-gray-400'}`}>
                      {msg.sender}
                    </span>
                    <span className="text-[9px] text-gray-500 font-mono">{msg.time}</span>
                  </div>
                  <div className={`
                    p-3 rounded-2xl text-sm leading-relaxed
                    ${msg.isMe ? 'bg-hive-yellow-base text-black rounded-tr-sm shadow-[0_2px_10px_rgba(255,221,0,0.2)]' : 'bg-black/40 text-gray-200 border border-white/5 rounded-tl-sm'}
                  `}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-hive-yellow-base/10 bg-hive-card/80 backdrop-blur">
            <form onSubmit={handleSendMessage} className="bg-black/50 rounded-full flex items-center border border-white/10 p-1 pl-4 focus-within:border-hive-yellow-base/50 focus-within:bg-black transition-all">
              <input
                type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Type your message..." className="bg-transparent border-none outline-none text-sm text-white flex-1 py-2"
              />
              <button
                type="submit" disabled={!chatMessage.trim()}
                className={`p-2 rounded-full ml-2 transition-all flex items-center justify-center ${chatMessage.trim() ? 'bg-hive-yellow-base text-black hover:bg-hive-yellow-neon hover:shadow-[0_0_15px_rgba(255,221,0,0.4)] hover:scale-105' : 'text-gray-500 bg-transparent'}`}
              >
                <Hexagon size={16} fill={chatMessage.trim() ? 'currentColor' : 'none'} className={chatMessage.trim() ? 'text-black' : ''} />
              </button>
            </form>
          </div>
        </div>
      </>
    );
  };

  const renderHomepage = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-hive-red-neon/10 blur-[120px] rounded-full pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="z-10 w-full max-w-md flex flex-col gap-8">
        <div className="flex flex-col items-center">
          <Hexagon className="text-hive-red-neon mb-2 drop-shadow-[0_0_15px_rgba(255,0,51,0.8)]" fill="currentColor" size={72} />
          <h1 className="text-5xl font-black text-hive-yellow-neon tracking-tighter drop-shadow-[0_0_15px_rgba(255,221,0,0.5)]">HIVEMIND</h1>
          <p className="text-gray-400 text-center mt-2 font-mono text-sm uppercase tracking-widest">Synchronized Group Consensus</p>
        </div>

        <div className="bg-hive-card/80 backdrop-blur border border-hive-yellow-base/20 p-8 rounded-3xl shadow-[0_0_30px_rgba(255,221,0,0.05)]">
          <div className="mb-6">
            <label className="block text-sm font-bold text-hive-yellow-base mb-2 uppercase tracking-wider">Your Name</label>
            <input
              type="text" value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="Enter alias..."
              className="w-full bg-black/50 border border-white/10 focus:border-hive-yellow-base rounded-xl px-4 py-3 text-white outline-none transition-colors"
            />
          </div>

          {!showJoinInput ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={handleCreateRoom}
                className="w-full bg-hive-yellow-base text-black font-black uppercase tracking-widest py-4 rounded-xl hover:bg-hive-yellow-neon transition-all hover:shadow-[0_0_20px_#ffdd00] hover:scale-[1.02] active:scale-95"
              >
                Create Room
              </button>
              <button
                onClick={() => setShowJoinInput(true)}
                className="w-full bg-transparent border-2 border-white/10 text-white font-bold uppercase tracking-widest py-3 rounded-xl hover:border-hive-yellow-base hover:text-hive-yellow-base transition-all"
              >
                Join Existing
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 animate-in slide-in-from-right-4 fade-in">
              <input
                type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Room Code"
                className="w-full bg-black/50 border border-white/10 focus:border-hive-yellow-base rounded-xl px-4 py-3 text-white outline-none font-mono uppercase transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowJoinInput(false)}
                  className="flex-shrink-0 bg-transparent border-2 border-white/10 text-white px-4 rounded-xl hover:border-white/30"
                >
                  <X size={20} />
                </button>
                <button
                  onClick={handleJoinRoom}
                  className="flex-1 bg-hive-yellow-base text-black font-black uppercase tracking-widest py-3 rounded-xl hover:bg-hive-yellow-neon transition-all hover:shadow-[0_0_20px_#ffdd00]"
                >
                  Join
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );

  const renderWaitingRoom = () => {
    const showInviteSlot = displayUsers.length < MAX_USERS;

    return (
      <div className="flex flex-col min-h-screen">
        {renderHeader()}
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,221,0,0.05)_0%,transparent_60%)] pointer-events-none" />

          <div className="z-10 flex flex-col items-center text-center max-w-lg w-full">
            <HoneycombLoader />

            <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-10 w-full max-w-full">
              <AnimatePresence>
                {displayUsers.map((u, i) => {
                  const isMe = u.id === socket?.id;
                  return (
                    <motion.div
                      key={u.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="relative group cursor-help"
                    >
                      <div className={`
                        w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center font-bold bg-hive-card transition-colors
                        ${isMe ? 'border-2 border-hive-yellow-neon shadow-[0_0_12px_rgba(255,234,0,0.6)] text-hive-yellow-neon text-lg md:text-xl' : 'border-2 border-hive-yellow-base text-hive-yellow-base text-base md:text-lg shadow-[0_0_10px_rgba(255,221,0,0.1)]'}
                      `}>
                        {u.initials}
                      </div>
                      {u.isHost && (
                        <div className="absolute -bottom-2 -right-2 bg-hive-red-neon text-white text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-hive-bg shadow-sm z-10">
                          HOST
                        </div>
                      )}
                      {isMe && !u.isHost && (
                        <div className="absolute -bottom-2 -right-2 bg-hive-yellow-base text-black text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-hive-bg shadow-sm z-10">
                          YOU
                        </div>
                      )}
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-xs text-gray-400 font-mono whitespace-nowrap transition-opacity">
                        {u.name}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {showInviteSlot && (
                <div title="Invite Members" className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center opacity-40 hover:opacity-100 hover:border-hive-yellow-base/50 transition-all cursor-help group">
                  <Plus className="text-white/30 group-hover:text-hive-yellow-base/50 transition-colors" size={20} />
                </div>
              )}
            </div>

            <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-wide">
              Waiting for the hive...
            </h2>
            <p className="text-gray-400 mb-12 flex items-center gap-2">
              Gathering minds before synchronization
            </p>

            <button
              onClick={startVoting}
              disabled={!isHost || displayUsers.length < 2}
              className={`
                w-full max-w-sm py-5 rounded-2xl font-black text-xl uppercase tracking-widest transition-all duration-300 relative overflow-hidden group
                ${isHost && displayUsers.length >= 2
                  ? 'bg-hive-yellow-base text-black shadow-[0_0_30px_rgba(255,221,0,0.5)] hover:scale-105'
                  : 'bg-white/5 text-white/30 border-2 border-dashed border-white/10 cursor-not-allowed'}
              `}
            >
              {isHost ? (
                displayUsers.length >= 2 ? "Initiate Sync Protocol" : "Waiting for members..."
              ) : (
                "Waiting for Host..."
              )}
              {isHost && displayUsers.length >= 2 && (
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 blur-sm" />
              )}
            </button>

            {isHost && displayUsers.length < 2 && (
              <p className="mt-4 text-xs text-hive-red-neon uppercase tracking-wide">Requires minimum 2 members</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderVotingRoom = () => (
    <div className="flex flex-col min-h-screen relative overflow-hidden">
      {renderHeader()}
      {renderSidebar()}

      <div className={`p-4 md:p-8 flex-1 transition-all duration-300 ${showSidebar ? 'md:mr-80 lg:mr-96' : ''}`}>
        <div className="max-w-5xl mx-auto flex flex-col relative z-10 pt-4">

          <div className="flex justify-between items-center mb-10 gap-4">
            {/* Desktop Avatars */}
            <div className="hidden md:flex flex-wrap items-center gap-3">
              {displayUsers.map((u) => {
                const isMe = u.id === socket?.id;
                return (
                  <div key={u.id} className="relative group cursor-help">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold bg-hive-card border-2 transition-colors 
                      ${isMe ? 'border-hive-yellow-neon text-hive-yellow-neon shadow-[0_0_10px_rgba(255,234,0,0.6)] text-lg' :
                        u.vote ? 'border-hive-green-neon text-hive-green-neon shadow-[0_0_10px_rgba(57,255,20,0.2)]' : 'border-hive-yellow-base text-hive-yellow-base'}`}>
                      {u.initials}
                    </div>
                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-hive-bg ${u.vote ? 'bg-hive-green-neon' : 'bg-hive-red-neon'}`} />
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 bg-black/80 px-2 py-1 rounded">
                      {isMe ? "You" : u.name}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Avatars */}
            <div className="flex md:hidden items-center gap-2">
              {displayUsers.slice(0, 4).map((u) => {
                const isMe = u.id === socket?.id;
                return (
                  <div key={u.id} className="relative group">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold bg-hive-card border-2 transition-colors 
                        ${isMe ? 'border-hive-yellow-neon text-hive-yellow-neon shadow-[0_0_8px_rgba(255,234,0,0.6)]' :
                        u.vote ? 'border-hive-green-neon text-hive-green-neon' : 'border-hive-yellow-base text-hive-yellow-base'}`}>
                      {u.initials}
                    </div>
                    <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-hive-bg ${u.vote ? 'bg-hive-green-neon' : 'bg-hive-red-neon'}`} />
                  </div>
                );
              })}
              {displayUsers.length > 4 && (
                <div onClick={() => setShowModal(true)} className="w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-xs text-white font-bold cursor-pointer">
                  +{displayUsers.length - 4}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className={`p-3 rounded-xl border transition-all
                  ${showSidebar ? 'bg-hive-yellow-base text-black border-hive-yellow-base shadow-[0_0_15px_#ffdd00]' : 'bg-hive-card text-hive-yellow-base border-hive-yellow-base/30 hover:border-hive-yellow-base shadow-sm'}`}
              >
                <MessageSquare size={20} className={showSidebar ? "text-black drop-shadow-sm" : "drop-shadow-[0_0_5px_rgba(255,221,0,0.5)]"} />
              </button>

              <div className={`flex items-center gap-2 font-mono text-xl md:text-2xl font-bold px-3 py-2 rounded-xl backdrop-blur ${timeLeft < 30 ? 'text-hive-red-neon bg-hive-red-neon/10 animate-pulse border border-hive-red-neon/30 shadow-[0_0_10px_rgba(255,0,51,0.2)]' : 'text-hive-yellow-base bg-hive-card border border-hive-yellow-base/20 shadow-[0_0_15px_rgba(255,221,0,0.1)]'}`}>
                <Clock size={22} className="hidden md:block" />
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-5xl font-black mb-3 text-hive-yellow-neon drop-shadow-[0_0_15px_rgba(255,221,0,0.5)] uppercase tracking-wider transition-all">
              {allVoted ? "Hive converging..." : `${displayUsers.length} minds deciding...`}
            </h1>
            <p className="text-gray-400">Lock in your selection to reach group consensus.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <AnimatePresence>
              {MOCK_OPTIONS.map((opt) => {
                const isSelected = myVote === opt.title;
                const isVetoed = vetoedOption === opt.title;
                const voteCount = displayUsers.filter(u => u.vote === opt.title).length;
                const percent = displayUsers.length ? Math.round((voteCount / displayUsers.length) * 100) : 0;

                return (
                  <motion.div
                    key={opt.id}
                    layoutId={opt.title}
                    whileHover={!isVetoed ? { scale: 1.02 } : {}}
                    whileTap={!isVetoed ? { scale: 0.98 } : {}}
                    onClick={() => {
                      if (isVetoed) return;
                      setMyVote(opt.title);
                      socket.emit("cast-vote", { roomId: roomCode, vote: opt.title });
                    }}
                    className={`
                      relative p-8 rounded-2xl cursor-pointer border-2 transition-all flex flex-col justify-between min-h-[220px] overflow-hidden group
                      ${isVetoed ? 'bg-hive-red-neon/10 border-hive-red-neon/50' :
                        isSelected
                          ? 'border-hive-yellow-base bg-hive-yellow-base/10 shadow-[0_0_30px_rgba(255,221,0,0.25)]'
                          : 'border-white/5 bg-hive-card hover:border-hive-yellow-base/50 hover:bg-hive-card/80'}
                    `}
                  >

                    {/* Veto Override Tint */}
                    {isVetoed && <div className="absolute inset-0 bg-hive-bg/60 backdrop-blur-[2px] z-10" />}

                    {isVetoed && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 border-[3px] border-hive-red-neon text-hive-red-neon font-black text-3xl md:text-4xl p-2 rounded-xl z-20 pointer-events-none drop-shadow-[0_0_15px_rgba(255,0,51,0.8)] tracking-widest bg-hive-bg/80">
                        VETOED
                      </div>
                    )}

                    <div className="z-20 mb-6 relative">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`text-xl md:text-2xl font-bold transition-colors ${isSelected && !isVetoed ? 'text-hive-yellow-neon drop-shadow-[0_0_8px_rgba(255,221,0,0.8)]' : isVetoed ? 'text-gray-500' : 'text-white'}`}>
                          {opt.title}
                        </h3>

                        {!isVetoed && isSelected && (
                          <Hexagon size={24} fill="currentColor" className="text-hive-yellow-neon drop-shadow-[0_0_5px_rgba(255,234,0,0.8)] animate-pulse" />
                        )}

                        {!isVetoed && !isSelected && (
                          <button
                            onClick={(e) => handleVeto(e, opt.title)}
                            disabled={hasVetoed}
                            className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1 p-1.5 rounded transition-all z-30 ${hasVetoed ? 'text-white/10 cursor-not-allowed' : 'text-hive-red-base hover:text-white hover:bg-hive-red-neon hover:shadow-[0_0_10px_#ff0033]'}`}
                            title={hasVetoed ? "Veto already used" : "One-time veto"}
                          >
                            🚫 Veto
                          </button>
                        )}
                      </div>
                      <p className={`text-sm leading-relaxed ${isVetoed ? 'text-gray-600' : 'text-gray-400'}`}>{opt.desc}</p>
                    </div>

                    <div className="z-20 flex items-center justify-between pt-4 border-t border-white/5 relative">
                      <div className="flex items-center gap-2">
                        <Users size={16} className={isSelected && !isVetoed ? 'text-hive-yellow-base' : 'text-gray-500'} />
                        <span className="text-sm font-mono text-gray-300">{voteCount} Votes</span>
                      </div>
                      <span className={`text-sm font-bold font-mono ${isSelected && !isVetoed ? 'text-hive-yellow-neon' : 'text-gray-500'}`}>
                        {percent}% Approval
                      </span>
                    </div>

                    {/* Progress Bar background */}
                    {!isVetoed && (
                      <div className="absolute bottom-0 left-0 h-1 bg-hive-yellow-base/20 w-full z-20">
                        <div className="h-full bg-hive-yellow-neon shadow-[0_0_10px_#ffea00] transition-all duration-500" style={{ width: `${percent}%` }} />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="mt-12 text-center pb-8">
            <button onClick={() => setPhase('consensus')} className="text-xs text-white/20 hover:text-white/50">(Debug trigger consensus)</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderConsensusScreen = () => (
    <div className="flex flex-col min-h-screen bg-hive-bg">
      {renderHeader()}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">

        {/* Confetti/Glow background effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-hive-green-neon/5 blur-[150px] rounded-full animate-pulse" />
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}
            className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20"
          />
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="text-center mb-12 z-10"
        >
          <div className="inline-flex items-center gap-3 bg-hive-green-neon/10 border border-hive-green-neon/30 px-6 py-2 rounded-full mb-6 shadow-[0_0_15px_rgba(57,255,20,0.2)]">
            <div className="w-2 h-2 rounded-full bg-hive-green-neon animate-ping" />
            <span className="text-hive-green-neon font-mono font-bold uppercase tracking-widest text-sm">Perfect Synchronization</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-hive-green-neon drop-shadow-[0_0_20px_rgba(57,255,20,0.6)] uppercase tracking-tight mb-4">
            Consensus Reached
          </h1>
          <p className="text-hive-yellow-base text-xl font-bold uppercase tracking-widest drop-shadow-[0_0_10px_rgba(255,221,0,0.4)]">
            The hive has spoken.
          </p>
        </motion.div>

        <motion.div
          layoutId={consensus || "Option A"} // Fallback for debug viewing
          className="relative p-10 md:p-16 rounded-[2.5rem] border-2 border-hive-green-neon bg-hive-card shadow-[0_0_80px_rgba(57,255,20,0.15)] max-w-2xl w-full text-center overflow-hidden z-10 group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-hive-green-neon/10 to-transparent pointer-events-none" />

          <motion.div
            initial={{ rotate: -90, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", delay: 0.2, bounce: 0.6 }}
            className="mx-auto w-24 h-24 bg-hive-green-neon/20 rounded-full flex items-center justify-center mb-8 border border-hive-green-neon/50 shadow-[0_0_30px_rgba(57,255,20,0.4)]"
          >
            <CheckCircle2 className="text-hive-green-neon" size={56} />
          </motion.div>

          <h2 className="text-5xl font-black text-white mb-4 drop-shadow-md">{consensus || "Option A"}</h2>

          <div className="flex flex-wrap justify-center items-center gap-3 mt-8">
            {displayUsers.map(u => (
              <div key={`con-${u.id}`} className="w-10 h-10 rounded-full bg-hive-green-neon/20 border-2 border-hive-green-neon flex items-center justify-center text-hive-green-neon font-bold text-xs shadow-[0_0_10px_rgba(57,255,20,0.4)]">
                {u.initials}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="mt-12 z-10"
        >
          <button
            onClick={leaveHive}
            className="bg-transparent border-2 border-hive-yellow-base text-hive-yellow-base hover:bg-hive-yellow-base hover:text-black font-black uppercase tracking-widest px-8 py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(255,221,0,0.1)] hover:shadow-[0_0_30px_rgba(255,221,0,0.4)]"
          >
            Start New Room
          </button>
        </motion.div>

      </div>
    </div>
  );

  return (
    <>
      {renderToast()}
      {renderSyncedModal()}
      {phase === 'home' && renderHomepage()}
      {phase === 'waiting' && renderWaitingRoom()}
      {phase === 'voting' && renderVotingRoom()}
      {phase === 'consensus' && renderConsensusScreen()}
    </>
  );
}