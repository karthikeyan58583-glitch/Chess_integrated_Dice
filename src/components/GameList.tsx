import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Users, Swords, ArrowRight, Sparkles, Copy, Check, HelpCircle, Trophy } from 'lucide-react';

interface GameListProps {
  onJoinGame: (gameId: string) => void;
  userStats: { wins: number; losses: number; draws: number };
  arenaUsername?: string;
  arenaPhotoUrl?: string;
}

export function GameList({ onJoinGame, userStats }: GameListProps) {
  const [copied, setCopied] = useState(false);
  const [createdLink, setCreatedLink] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinError, setJoinError] = useState('');
  const [createdRoomId, setCreatedRoomId] = useState('');

  const handleJoinByCode = async () => {
    let cleanCode = joinRoomId.trim();
    if (!cleanCode) {
      setJoinError('Please enter a room code.');
      return;
    }
    if (!cleanCode.startsWith('room_')) {
      cleanCode = 'room_' + cleanCode;
    }

    try {
      const res = await fetch(`/api/rooms/${cleanCode}`);
      if (res.ok) {
        onJoinGame(cleanCode);
      } else {
        const errData = await res.json();
        setJoinError(errData.error || 'Room not found. Check the code.');
      }
    } catch (e) {
      onJoinGame(cleanCode);
    }
  };


  const generateOnlineRoom = async () => {
    setGeneratingLink(true);
    setLinkError('');
    const roomId = 'room_' + Math.random().toString(36).substring(2, 11);
    try {
      const res = await fetch('/api/server-info');
      const { lanIp, port } = await res.json();
      // Use LAN IP so the link works on other devices on the same Wi-Fi.
      // Fall back to window.location.origin if the server returns localhost
      // (e.g. when running in a cloud sandbox).
      const isLocalHostOrIp = 
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' || 
        window.location.hostname.startsWith('192.168.') || 
        window.location.hostname.startsWith('10.') || 
        window.location.hostname.startsWith('172.');

      let origin: string;
      if (isLocalHostOrIp && lanIp && lanIp !== 'localhost') {
        origin = `http://${lanIp}:${port}`;
      } else {
        origin = window.location.origin;
        if (origin.includes('-dev-')) {
          origin = origin.replace('-dev-', '-pre-');
        }
      }
      const inviteLink = `${origin}${window.location.pathname}?room=${roomId}`;
      setCreatedLink(inviteLink);
      setCreatedRoomId(roomId);
      setCopied(false);
    } catch (e) {
      // Fallback: build link from current origin
      let origin = window.location.origin;
      if (origin.includes('-dev-')) {
        origin = origin.replace('-dev-', '-pre-');
      }
      setCreatedLink(`${origin}${window.location.pathname}?room=${roomId}`);
      setCreatedRoomId(roomId);
      setLinkError('Could not determine LAN IP — link may only work on this device.');
    } finally {
      setGeneratingLink(false);
    }
  };


  const handleCopyLink = () => {
    if (!createdLink) return;
    navigator.clipboard.writeText(createdLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 select-none">
      {/* Brand Hero */}
      <div className="text-center mb-12 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <h1 className="text-4xl md:text-5xl font-sans font-black tracking-tight text-white mb-4">
          DICE <span className="text-emerald-400">CHESS</span>
        </h1>
        <p className="text-sm md:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Classic Chess meets dynamic dice mechanics. Roll to determine your moves, strategize under constraint, and conquer the board!
        </p>
      </div>

      {/* Stats Display */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-10 p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-lg"
      >
        <div className="text-center">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold block">Wins</span>
          <span className="text-xl font-mono font-extrabold text-emerald-400 mt-0.5 block">{userStats.wins}</span>
        </div>
        <div className="text-center border-x border-zinc-800">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold block">Draws</span>
          <span className="text-xl font-mono font-extrabold text-zinc-300 mt-0.5 block">{userStats.draws}</span>
        </div>
        <div className="text-center">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold block">Losses</span>
          <span className="text-xl font-mono font-extrabold text-rose-400 mt-0.5 block">{userStats.losses}</span>
        </div>
      </motion.div>

      {/* Main Mode Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* Local Play */}
        <motion.div 
          whileHover={{ y: -4, borderColor: 'rgba(16, 185, 129, 0.3)' }}
          className="bg-[#262421] border border-[#312e2b] rounded-2xl p-6 flex flex-col justify-between shadow-md transition-colors duration-200"
        >
          <div className="flex-1">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5 text-amber-400">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-sans font-extrabold text-white mb-2">Pass & Play</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Play side-by-side with a friend on the same screen. Sit together, take turns, zero setup or internet needed.
            </p>
          </div>
          <button
            onClick={() => onJoinGame('local')}
            className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white rounded-xl font-sans font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow"
          >
            <span>Start Local Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>

        {/* Online Friend */}
        <motion.div 
          whileHover={{ y: -4, borderColor: 'rgba(16, 185, 129, 0.4)' }}
          className="bg-[#262421] border-2 border-[#81b64c]/20 hover:border-[#81b64c]/40 rounded-2xl p-6 flex flex-col justify-between shadow-lg transition-colors duration-200"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 text-emerald-400">
              <Swords className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-sans font-extrabold text-white mb-2">Play with a Friend</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Generate a secure game invitation link, send it to a friend, and play in real-time. No sign-ups, no databases, purely direct!
            </p>
          </div>
          
          {createdLink ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-zinc-900/50 p-2 rounded-lg border border-zinc-800/80 mb-1">
                <span className="text-[10px] font-sans font-bold text-zinc-500 uppercase tracking-wider">Room Code</span>
                <span className="text-xs font-mono font-black text-emerald-400 select-all tracking-wider">{createdRoomId}</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 bg-zinc-950 rounded-lg border border-zinc-800">
                <input 
                  type="text" 
                  readOnly 
                  value={createdLink} 
                  className="bg-transparent border-none text-[10px] font-mono text-zinc-400 flex-1 outline-none select-all overflow-hidden"
                />
                <button
                  onClick={handleCopyLink}
                  className="p-1.5 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded transition"
                  title="Copy Link"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              
              {linkError && (
                <p className="text-[11px] text-amber-400 leading-relaxed font-medium bg-amber-500/10 p-2 rounded border border-amber-500/20">
                  ⚠️ {linkError}
                </p>
              )}

              {!linkError && (
                <p className="text-[11px] text-emerald-400/80 leading-relaxed bg-emerald-500/5 p-2 rounded border border-emerald-500/15">
                  📡 Share this link with a friend on the <strong>same Wi-Fi</strong>. They can open it on any device!
                </p>
              )}

              {window.location.origin.includes('-dev-') ? (
                <>
                  <p className="text-[11px] text-amber-400 leading-relaxed font-medium bg-amber-500/10 p-2 rounded border border-amber-500/20">
                    ⚠️ You are in the <strong>AI Studio Editor</strong>. To play together, both you and your friend must open the shared link in new tabs!
                  </p>
                  <button
                    onClick={() => {
                      window.open(createdLink, '_blank');
                    }}
                    className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white rounded-xl font-sans font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow"
                  >
                    <span>Open Game in New Tab ↗</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    const urlParams = new URLSearchParams(createdLink.split('?')[1]);
                    const room = urlParams.get('room');
                    if (room) onJoinGame(room);
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-xl font-sans font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow"
                >
                  <span>Enter Room & Wait</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={generateOnlineRoom}
                disabled={generatingLink}
                className="w-full py-3 px-4 bg-[#81b64c] hover:bg-[#90ca5a] disabled:opacity-60 disabled:cursor-wait active:scale-[0.98] text-slate-950 font-sans font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow"
              >
                <span>{generatingLink ? 'Generating…' : 'Generate Invite Link'}</span>
                {!generatingLink && <ArrowRight className="w-3.5 h-3.5" />}
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[#312e2b]"></div>
                <span className="flex-shrink mx-3 text-[10px] font-sans font-bold tracking-wider text-zinc-500 uppercase">Or</span>
                <div className="flex-grow border-t border-[#312e2b]"></div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5 p-1.5 bg-zinc-950 rounded-lg border border-zinc-800">
                  <input 
                    type="text" 
                    placeholder="Enter Room Code (e.g. room_abc123)" 
                    value={joinRoomId}
                    onChange={(e) => {
                      setJoinRoomId(e.target.value);
                      setJoinError('');
                    }}
                    className="bg-transparent border-none text-[11px] font-mono text-zinc-300 flex-1 outline-none px-2 placeholder:text-zinc-600"
                  />
                  <button
                    onClick={handleJoinByCode}
                    className="py-1.5 px-3 bg-[#81b64c] hover:bg-[#90ca5a] active:scale-[0.95] text-slate-950 rounded-md font-sans font-bold text-[10px] transition cursor-pointer"
                  >
                    Join
                  </button>
                </div>
                {joinError && (
                  <p className="text-[10px] text-rose-400 font-medium px-1">❌ {joinError}</p>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick Play Rules Panel */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="p-6 bg-[#21201d] border border-[#2d2a27] rounded-2xl"
      >
        <h4 className="text-sm font-sans font-extrabold text-[#efe3cb] flex items-center gap-2 mb-3">
          <HelpCircle className="w-4 h-4 text-emerald-400" />
          <span>How Dice Chess Works</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400 leading-relaxed">
          <div>
            <span className="font-bold text-[#efe3cb] block mb-1">1. Phase 1 (Turns 1-5)</span>
            No rolls. Each side receives exactly 1 automatic move per turn to establish positions.
          </div>
          <div>
            <span className="font-bold text-[#efe3cb] block mb-1">2. Phase 2 & 3</span>
            Turns 6-10 roll 1-3 moves. Turns 11+ roll 1-6 moves. This determines your move quota for the turn!
          </div>
          <div>
            <span className="font-bold text-[#efe3cb] block mb-1">3. Check Constraints</span>
            If a King is checked, the remaining move quota is restricted—you must resolve the check immediately!
          </div>
        </div>
      </motion.div>
    </div>
  );
}
