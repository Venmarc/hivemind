"use client";
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { useHiveStore, HiveUser } from '../store/useHiveStore';
import { LogOut, Users, Zap, CheckCircle2, Clock, Copy, Hexagon, X, MessageSquare, Plus, Loader2 } from 'lucide-react';

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
  const { consensus, setUsers, setConsensus, reset } = useHiveStore();

  // App Phase & State
  const [phase, setPhase] = useState<AppPhase>('home');
  const [myName, setMyName] = useState("");
  const [myVote, setMyVote] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);

  // Room State
  const [roomCode, setRoomCode] = useState("MAIN-77");
  const [timeLeft, setTimeLeft] = useState(180);

  // UI States
  const [showToast, setShowToast] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  // --- Real-time Hooks (Placeholder / Setup) ---
  useEffect(() => {
    socket = io();
    socket.on("room-update", (updatedUsers: HiveUser[]) => setUsers(updatedUsers));
    socket.on("consensus-reached", (winner: string) => {
      setConsensus(winner);
      setPhase('consensus');
    });
    // Add real-time hooks here for phase transitions:
    // socket.on("phase-change", (newPhase) => setPhase(newPhase));

    return () => { socket.disconnect(); };
  }, [setUsers, setConsensus]);

  useEffect(() => {
    if (phase !== 'voting' || consensus) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, consensus]);


  // --- Mock User Merging ---
  const myUser: ExtendedUser = { id: "me", name: myName || "User", vote: myVote, isHost, initials: (myName || "U").substring(0, 2).toUpperCase() };

  const mockUsers: ExtendedUser[] = [
    { id: "mock-1", name: "PC", vote: "Option A", isHost: true, initials: "PC" },
    { id: "mock-2", name: "Guest", vote: null, isHost: false, initials: "GU" }
  ];

  // In real app, `displayUsers` would simply be `users` from global state syncing.
  // We mock a list including ourselves.
  const displayUsers: ExtendedUser[] = phase === 'home' ? [] : [myUser, ...mockUsers];

  // --- Utilities ---
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleCreateRoom = () => {
    if (!myName.trim()) return alert("Enter your name");
    setIsHost(true);
    setRoomCode(Math.random().toString(36).substring(2, 8).toUpperCase());
    // socket.emit('create-room', { hostName: myName, roomCode })
    setPhase('waiting');
  };

  const handleJoinRoom = () => {
    if (!myName.trim()) return alert("Enter your name");
    if (!joinCode.trim()) return alert("Enter room code");
    setIsHost(false);
    setRoomCode(joinCode.toUpperCase());
    // socket.emit('join-room', { userName: myName, roomCode })
    setPhase('waiting');
  };

  const startVoting = () => {
    // socket.emit('start-voting', { roomCode })
    setPhase('voting');
  };

  const leaveHive = () => {
    reset();
    setPhase('home');
    setMyVote(null);
    setIsHost(false);
    setMyName("");
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
              {displayUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 bg-black/30 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold border-2 ${u.vote ? 'border-hive-green-neon text-hive-green-neon' : 'border-hive-yellow-base text-hive-yellow-base'}`}>
                      {u.initials}
                    </div>
                    <div>
                      <p className="font-bold text-white flex items-center gap-2">
                        {u.name} {u.id === 'me' && <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">You</span>}
                        {u.isHost && <span className="text-xs bg-hive-yellow-base text-black px-2 py-0.5 rounded font-black tracking-widest uppercase">Host</span>}
                      </p>
                      <p className="text-xs text-gray-400">
                        {phase === 'voting' ? (u.vote ? 'Vote cast' : 'Deciding...') : 'Ready'}
                      </p>
                    </div>
                  </div>
                  {phase === 'voting' && (
                    <div className={`w-3 h-3 rounded-full ${u.vote ? 'bg-hive-green-neon shadow-[0_0_8px_#39ff14]' : 'bg-hive-red-neon shadow-[0_0_8px_#ff0033]'}`} />
                  )}
                </div>
              ))}
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

      <div className="flex items-center gap-6">
        <button
          onClick={() => setShowModal(true)}
          className="hidden md:flex items-center gap-2 bg-black/50 px-4 py-1.5 rounded-full border border-hive-green-neon/30 hover:border-hive-green-neon/80 transition-all cursor-pointer shadow-[0_0_10px_rgba(57,255,20,0.1)] hover:shadow-[0_0_15px_rgba(57,255,20,0.3)]"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-hive-green-neon shadow-[0_0_8px_#39ff14] animate-pulse" />
          <span className="font-mono text-sm text-hive-green-neon font-bold">
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

  const renderSidebar = () => (
    <div className={`fixed right-0 top-[73px] bottom-0 w-80 bg-hive-card border-l border-hive-yellow-base/10 transform transition-transform duration-300 z-20 ${showSidebar ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="font-bold text-hive-yellow-base flex items-center gap-2"><MessageSquare size={18} /> Hive Chat</h3>
        <button onClick={() => setShowSidebar(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
      </div>
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
        <div className="bg-black/40 p-3 rounded-xl rounded-tl-none border border-white/5">
          <span className="text-xs text-hive-yellow-base font-bold mb-1 block">PC (Host)</span>
          <p className="text-sm text-gray-300">Let&apos;s try to reach consensus quickly.</p>
        </div>
      </div>
      <div className="p-4 border-t border-white/5">
        <div className="bg-black/40 rounded-full flex items-center border border-white/10 p-1 px-3">
          <input type="text" placeholder="Type a message..." className="bg-transparent border-none outline-none text-sm text-white flex-1 py-2" />
          <button className="text-hive-yellow-base p-1"><Zap size={16} /></button>
        </div>
      </div>
    </div>
  );

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
              type="text"
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              placeholder="Enter alias..."
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
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Room Code"
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

  const renderWaitingRoom = () => (
    <div className="flex flex-col min-h-screen">
      {renderHeader()}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,221,0,0.05)_0%,transparent_60%)] pointer-events-none" />

        <div className="z-10 flex flex-col items-center text-center max-w-lg">
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            <AnimatePresence>
              {displayUsers.map((u, i) => (
                <motion.div
                  key={u.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="relative group"
                >
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold bg-hive-card text-hive-yellow-base border-2 border-hive-yellow-base shadow-[0_0_15px_rgba(255,221,0,0.2)]">
                    {u.initials}
                  </div>
                  {u.isHost && (
                    <div className="absolute -bottom-2 -right-2 bg-hive-red-neon text-white text-[10px] font-black px-2 py-1 rounded-full border-2 border-hive-bg">
                      HOST
                    </div>
                  )}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-xs text-gray-400 font-mono whitespace-nowrap transition-opacity">
                    {u.name}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Empty slots placeholders (optional visual polish) */}
            {displayUsers.length < 5 && Array(5 - displayUsers.length).fill(0).map((_, i) => (
              <div key={`empty-${i}`} className="w-16 h-16 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center opacity-50">
                <Plus className="text-white/20" />
              </div>
            ))}
          </div>

          <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-wide">
            Waiting for the hive...
          </h2>
          <p className="text-gray-400 mb-12 flex items-center gap-2">
            <Loader2 className="animate-spin text-hive-yellow-base" size={16} />
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
              displayUsers.length >= 2 ? "Initiate Sync Protocol" : "Waiting for subjects..."
            ) : (
              "Waiting for Host..."
            )}
            {isHost && displayUsers.length >= 2 && (
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 blur-sm" />
            )}
          </button>

          {isHost && displayUsers.length < 2 && (
            <p className="mt-4 text-xs text-hive-red-neon uppercase tracking-wide">Requires minimum 2 subjects</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderVotingRoom = () => (
    <div className="flex flex-col min-h-screen relative overflow-hidden">
      {renderHeader()}
      {renderSidebar()}

      <div className={`p-4 md:p-8 flex-1 transition-all duration-300 ${showSidebar ? 'mr-80' : ''}`}>
        <div className="max-w-5xl mx-auto flex flex-col relative z-10">

          <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
            <div className="flex items-center gap-3">
              {displayUsers.map((u, i) => (
                <div key={u.id} className="relative group cursor-help">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold bg-hive-card border-2 transition-colors ${u.vote ? 'border-hive-green-neon text-hive-green-neon shadow-[0_0_10px_rgba(57,255,20,0.2)]' : 'border-hive-yellow-base text-hive-yellow-base'}`}>
                    {u.initials}
                  </div>
                  <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-hive-bg ${u.vote ? 'bg-hive-green-neon' : 'bg-hive-red-neon'}`} />
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 bg-black/80 px-2 py-1 rounded">
                    {u.name}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <button onClick={() => setShowSidebar(!showSidebar)} className={`p-3 rounded-full border transition-all ${showSidebar ? 'bg-hive-yellow-base text-black border-hive-yellow-base shadow-[0_0_15px_#ffdd00]' : 'bg-hive-card text-hive-yellow-base border-hive-yellow-base/30 hover:border-hive-yellow-base'}`}>
                <MessageSquare size={20} />
              </button>

              <div className={`flex items-center gap-2 font-mono text-2xl font-bold px-4 py-2 rounded-xl backdrop-blur ${timeLeft < 30 ? 'text-hive-red-neon bg-hive-red-neon/10 animate-pulse border border-hive-red-neon/30' : 'text-hive-yellow-base bg-hive-card border border-hive-yellow-base/20 shadow-[0_0_15px_rgba(255,221,0,0.1)]'}`}>
                <Clock size={24} />
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-black mb-3 text-white uppercase tracking-wider drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              Awaiting Synchronization
            </h1>
            <p className="text-gray-400">Lock in your selection to reach group consensus.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <AnimatePresence>
              {MOCK_OPTIONS.map((opt) => {
                const isSelected = myVote === opt.title;
                const voteCount = displayUsers.filter(u => u.vote === opt.title).length;
                const percent = displayUsers.length ? Math.round((voteCount / displayUsers.length) * 100) : 0;

                return (
                  <motion.div
                    key={opt.id}
                    layoutId={opt.title}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setMyVote(opt.title);
                      // socket.emit("cast-vote", { roomId: roomCode, vote: opt.title });
                    }}
                    className={`
                      relative p-8 rounded-2xl cursor-pointer border-2 transition-all flex flex-col justify-between min-h-[220px] overflow-hidden group
                      ${isSelected
                        ? 'border-hive-yellow-base bg-hive-yellow-base/10 shadow-[0_0_30px_rgba(255,221,0,0.25)]'
                        : 'border-white/5 bg-hive-card hover:border-hive-yellow-base/50 hover:bg-hive-card/80'}
                    `}
                  >
                    <div className="z-10 mb-6">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`text-2xl font-bold ${isSelected ? 'text-hive-yellow-neon drop-shadow-[0_0_8px_rgba(255,221,0,0.8)]' : 'text-white'}`}>
                          {opt.title}
                        </h3>
                        {isSelected && <Zap className="text-hive-yellow-neon fill-hive-yellow-neon drop-shadow-[0_0_5px_rgba(255,221,0,0.8)]" size={24} />}
                      </div>
                      <p className="text-gray-400 text-sm leading-relaxed">{opt.desc}</p>
                    </div>

                    <div className="z-10 flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <Users size={16} className={isSelected ? 'text-hive-yellow-base' : 'text-gray-500'} />
                        <span className="text-sm font-mono text-gray-300">{voteCount} Votes</span>
                      </div>
                      <span className={`text-sm font-bold font-mono ${isSelected ? 'text-hive-yellow-neon' : 'text-gray-500'}`}>
                        {percent}% Approval
                      </span>
                    </div>

                    {/* Progress Bar background */}
                    <div className="absolute bottom-0 left-0 h-1 bg-hive-yellow-base/20 w-full">
                      <div className="h-full bg-hive-yellow-neon shadow-[0_0_10px_#ffea00] transition-all duration-500" style={{ width: `${percent}%` }} />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="mt-12 text-center">
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
          <div className="inline-flex items-center gap-3 bg-hive-green-neon/10 border border-hive-green-neon/30 px-6 py-2 rounded-full mb-6">
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

          <div className="flex justify-center items-center gap-3 mt-8">
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