"use client";
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { useHiveStore, HiveUser } from '../store/useHiveStore';
import { LogOut, Users, Zap } from 'lucide-react';

let socket: Socket;

export default function HiveMind() {
  const { users, consensus, setUsers, setConsensus, reset } = useHiveStore();
  const [joined, setJoined] = useState(false);
  const [myVote, setMyVote] = useState<string | null>(null);
  const options = ["Option A", "Option B", "Option C"];

  useEffect(() => {
    socket = io();
    socket.on("room-update", (updatedUsers: HiveUser[]) => setUsers(updatedUsers));
    socket.on("consensus-reached", (winner: string) => setConsensus(winner));
    return () => { socket.disconnect(); };
  }, [setUsers, setConsensus]);

  const join = () => {
    socket.emit("join-room", { roomId: "main-room", userName: `User-${Math.floor(Math.random() * 100)}` });
    setJoined(true);
  };

  if (!joined) return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
      <button onClick={join} className="px-8 py-4 bg-blue-600 rounded-full font-bold hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.5)]">
        Enter the HiveMind
      </button>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8 font-sans">
      <nav className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-4 bg-slate-900/50 p-3 rounded-xl border border-blue-500/30">
          <Users className="text-blue-400" />
          <span className="font-mono">{users.length} Minds Synced</span>
          <div className="flex gap-1 ml-4">
            {users.map(u => (
              <div key={u.id} className={`w-3 h-3 rounded-full ${u.vote ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-slate-700'}`} title={u.name} />
            ))}
          </div>
        </div>
        <button onClick={() => { reset(); window.location.reload(); }} className="flex gap-2 items-center text-slate-400 hover:text-red-400 transition-colors">
          <LogOut size={20} /> Leave Hive
        </button>
      </nav>

      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          {consensus ? "Consensus Reached" : "Awaiting Synchronization"}
        </h1>

        {users.length < 2 ? (
          <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }} className="text-blue-300/60 uppercase tracking-widest flex items-center justify-center gap-2">
            <Zap size={16} /> Waiting for more minds...
          </motion.p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <AnimatePresence>
              {options.map((opt) => (
                (!consensus || consensus === opt) && (
                  <motion.div
                    key={opt}
                    layoutId={opt}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    onClick={() => {
                      setMyVote(opt);
                      socket.emit("cast-vote", { roomId: "main-room", vote: opt });
                    }}
                    className={`p-10 rounded-2xl cursor-pointer border-2 transition-all ${consensus === opt ? 'border-green-400 bg-green-400/10 shadow-[0_0_40px_rgba(74,222,128,0.2)]' : myVote === opt ? 'border-blue-400 bg-blue-500/20' : 'border-slate-800 bg-slate-900/50 hover:border-blue-500'}`}
                  >
                    <h3 className="text-xl font-bold">{opt}</h3>
                  </motion.div>
                )
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </main>
  );
}