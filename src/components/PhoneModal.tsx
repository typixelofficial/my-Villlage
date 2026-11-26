import { useEffect, useState } from 'react';
import {
  Bell,
  ExternalLink,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { useGameStore } from '../store/gameStore.ts';
import { multiplayer } from '../lib/multiplayer.ts';
import { voiceChat } from '../lib/voiceChat.ts';
import { PlayerAvatarDP } from './PlayerAvatarDP.tsx';

function formatTimer(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function PhoneModal() {
  const setActivePanel = useGameStore((s) => s.setActivePanel);
  const setDirectChatTargetUid = useGameStore((s) => s.setDirectChatTargetUid);
  const clearUnreadUpdates = useGameStore((s) => s.clearUnreadUpdates);
  const profile = useGameStore((s) => s.profile);
  const isAdmin = useGameStore((s) => s.isAdmin);
  const remotePlayers = useGameStore((s) => s.remotePlayers);
  const phoneCall = useGameStore((s) => s.phoneCall);
  const typixelUpdates = useGameStore((s) => s.typixelUpdates);
  const voiceJoined = useGameStore((s) => s.voiceJoined);
  const voiceMuted = useGameStore((s) => s.voiceMuted);

  const [tab, setTab] = useState<'calls' | 'updates' | 'directory'>('calls');
  const [query, setQuery] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    clearUnreadUpdates();
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [clearUnreadUpdates]);

  if (!profile) return null;

  const onlineList = Object.values(remotePlayers).filter((rp) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      rp.displayName.toLowerCase().includes(q) ||
      (rp.instagramId || '').toLowerCase().includes(q)
    );
  });

  const handleAcceptCall = () => {
    if (!phoneCall) return;
    multiplayer.acceptCall(phoneCall.callId);
    if (!voiceJoined) {
      void voiceChat.joinVoice();
    }
  };

  const handleSendAdminAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertTitle.trim() || !alertMessage.trim()) return;
    multiplayer.adminPublishUpdate(alertTitle.trim(), alertMessage.trim());
    setAlertTitle('');
    setAlertMessage('');
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/68 flex items-center justify-center p-4 pointer-events-auto">
      <div className="w-full max-w-[390px] max-h-[86vh] bg-[#0b1117] border-2 border-slate-700/80 rounded-[28px] shadow-2xl flex flex-col overflow-hidden">
        {/* Smartphone Status Bar */}
        <div className="px-5 pt-3 pb-2 bg-[#070b0f] flex items-center justify-between text-[11px] text-slate-300 border-b border-white/8">
          <div className="flex items-center gap-1.5 font-mono-nums font-semibold">
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Typixel Phone</span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-300">5G</span>
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              aria-label="Close phone"
              className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active / Incoming Private Call Screen Banner */}
        {phoneCall && (
          <div className="p-4 bg-gradient-to-br from-emerald-950/90 via-[#0e1b24] to-[#0a1118] border-b border-emerald-400/35 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-emerald-600/30 border border-emerald-400/60 flex items-center justify-center shrink-0">
                  {phoneCall.status === 'ringing_in' ? (
                    <PhoneIncoming className="w-5 h-5 text-emerald-300 animate-bounce" />
                  ) : (
                    <PhoneCall className="w-5 h-5 text-emerald-300 animate-pulse" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{phoneCall.peerName}</div>
                  <div className="text-[11px] text-emerald-300 font-mono-nums">
                    {phoneCall.status === 'ringing_in'
                      ? 'Incoming Private Call...'
                      : phoneCall.status === 'ringing_out'
                        ? 'Calling...'
                        : `Connected · ${formatTimer(nowMs - (phoneCall.startedAtMs || nowMs))}`}
                  </div>
                </div>
              </div>
              {phoneCall.peerInstagram && (
                <span className="text-[10px] text-sky-300 shrink-0">@{phoneCall.peerInstagram}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {phoneCall.status === 'ringing_in' && (
                <button
                  type="button"
                  onClick={handleAcceptCall}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Accept
                </button>
              )}
              {phoneCall.status === 'active' && (
                <button
                  type="button"
                  onClick={() => {
                    if (!voiceJoined) {
                      void voiceChat.joinVoice();
                    } else {
                      voiceChat.toggleMute();
                    }
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                    voiceJoined && !voiceMuted
                      ? 'bg-sky-600 text-white'
                      : 'bg-white/10 hover:bg-white/15 text-slate-200'
                  }`}
                >
                  {voiceJoined && !voiceMuted ? (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      Voice Live
                    </>
                  ) : (
                    <>
                      <MicOff className="w-3.5 h-3.5" />
                      Enable Mic
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (phoneCall.status === 'ringing_in') {
                    multiplayer.declineCall(phoneCall.callId);
                  } else {
                    multiplayer.endCall();
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                {phoneCall.status === 'ringing_in' ? 'Decline' : 'End Call'}
              </button>
            </div>
          </div>
        )}

        {/* Phone Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-[#0e161e] border-b border-white/10">
          <button
            type="button"
            onClick={() => setTab('calls')}
            className={`py-2 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'calls' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            Calls
          </button>
          <button
            type="button"
            onClick={() => setTab('updates')}
            className={`py-2 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'updates' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Typixel ({typixelUpdates.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('directory')}
            className={`py-2 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'directory' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Find
          </button>
        </div>

        {/* Phone Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === 'calls' && (
            <>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search online citizens by name or @insta..."
                  className="w-full pl-8 pr-3 py-2 bg-[#131d26] border border-white/12 focus:border-emerald-400 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              {onlineList.length === 0 ? (
                <div className="p-6 bg-[#111922] border border-white/10 rounded-2xl text-center space-y-1.5">
                  <Users className="w-6 h-6 text-slate-500 mx-auto" />
                  <p className="text-xs font-semibold text-white">No other citizens online</p>
                  <p className="text-[11px] text-slate-400">
                    When friends join Green Valley, call them privately right from your Typixel Phone.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {onlineList.map((rp) => (
                    <div
                      key={rp.uid}
                      className="p-3 bg-[#121b24] border border-white/10 rounded-2xl flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PlayerAvatarDP
                          displayName={rp.displayName}
                          photoURL={rp.photoURL}
                          appearance={rp.appearance}
                          size="xs"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {rp.displayName}
                          </div>
                          <div className="text-[10px] text-sky-300 truncate">
                            {rp.instagramId ? `@${rp.instagramId}` : `Lv.${rp.level}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={Boolean(phoneCall)}
                          onClick={() => multiplayer.callPlayer(rp.uid)}
                          className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white rounded-xl cursor-pointer"
                          title="Private Voice Call"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDirectChatTargetUid(rp.uid);
                            setActivePanel('chat');
                          }}
                          className="p-2 bg-sky-600/25 hover:bg-sky-600/40 text-sky-200 rounded-xl cursor-pointer"
                          title="Direct Message"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'updates' && (
            <div className="space-y-3">
              {/* Admin Quick Broadcast Box */}
              {isAdmin && (
                <form
                  onSubmit={handleSendAdminAlert}
                  className="p-3 bg-amber-950/35 border border-amber-500/35 rounded-2xl space-y-2"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Push Live Typixel Alert to All Phones
                  </div>
                  <input
                    type="text"
                    maxLength={60}
                    value={alertTitle}
                    onChange={(e) => setAlertTitle(e.target.value)}
                    placeholder="Alert Headline (e.g. New Village Event!)"
                    className="w-full px-2.5 py-1.5 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                  />
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      maxLength={220}
                      value={alertMessage}
                      onChange={(e) => setAlertMessage(e.target.value)}
                      placeholder="Write official Typixel announcement..."
                      className="flex-1 px-2.5 py-1.5 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg cursor-pointer"
                      aria-label="Send update"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              )}

              {/* Typixel Updates Feed */}
              {typixelUpdates.length === 0 ? (
                <div className="p-5 bg-[#111922] border border-white/10 rounded-2xl text-center text-xs text-slate-400">
                  No updates pushed yet. Admin broadcasts appear here live!
                </div>
              ) : (
                typixelUpdates.map((u) => (
                  <div
                    key={u.id}
                    className="p-3.5 bg-[#121b24] border border-amber-400/25 rounded-2xl space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-amber-300">{u.title}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(u.createdAtMs).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">{u.message}</p>
                    <div className="text-[10px] text-slate-400">Posted by {u.author}</div>
                  </div>
                ))
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href="https://www.instagram.com/typixelofficial/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 bg-[#121b24] hover:bg-[#192633] border border-white/10 rounded-xl flex items-center justify-between text-[11px] font-semibold text-pink-300"
                >
                  <span>@typixelofficial</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="https://www.instagram.com/typixel.studio/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 bg-[#121b24] hover:bg-[#192633] border border-white/10 rounded-xl flex items-center justify-between text-[11px] font-semibold text-sky-300"
                >
                  <span>@typixel.studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {tab === 'directory' && (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-300 leading-relaxed">
                Quickly find any villa, custom house, shop, or citizen across Green Valley.
              </p>
              <button
                type="button"
                onClick={() => setActivePanel('search')}
                className="w-full p-3.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-2xl flex items-center justify-between cursor-pointer"
              >
                <span>Open Full House &amp; Person Search</span>
                <Search className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActivePanel('transit')}
                className="w-full p-3.5 bg-[#121b24] hover:bg-[#1a2632] border border-white/10 text-white text-xs font-semibold rounded-2xl flex items-center justify-between cursor-pointer"
              >
                <span>Live KSRTC Bus Tracker &amp; Tickets</span>
                <span className="text-amber-300 text-[11px]">24/7</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePanel('game_center')}
                className="w-full p-3.5 bg-[#121b24] hover:bg-[#1a2632] border border-white/10 text-white text-xs font-semibold rounded-2xl flex items-center justify-between cursor-pointer"
              >
                <span>Typixel Grand Game Center (54 Games)</span>
                <span className="text-purple-300 text-[11px]">VIP</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Home Bar */}
        <div className="py-2 bg-[#070b0f] flex justify-center border-t border-white/8">
          <div className="w-24 h-1 rounded-full bg-white/25" />
        </div>
      </div>
    </div>
  );
}
