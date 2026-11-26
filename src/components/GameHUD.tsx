import { useEffect, useState } from 'react';
import {
  BellRing,
  Briefcase,
  Building2,
  Car,
  ChevronDown,
  ChevronUp,
  Coins,
  ExternalLink,
  Gift,
  Heart,
  Home,
  Map as MapIcon,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  Navigation,
  Package,
  PhoneOff,
  ShieldCheck,
  Smile,
  Store,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import type { EmoteType } from '../shared/types.ts';
import { MISSIONS, SHOWCASE_ADS } from '../shared/worldData.ts';
import { getTodayDateKey } from '../lib/firebase.ts';
import { useGameStore } from '../store/gameStore.ts';
import type { MobileInputState } from './WorldViewport.tsx';
import { Minimap } from './Minimap.tsx';
import { GamePanels } from './GamePanels.tsx';
import { WorldMapModal } from './WorldMapModal.tsx';
import { PlayerAvatarDP } from './PlayerAvatarDP.tsx';
import { playSfx } from '../game/audio.ts';
import { voiceChat } from '../lib/voiceChat.ts';

interface GameHUDProps {
  mobileInputRef: React.MutableRefObject<MobileInputState>;
  onInteract: () => void;
}

const EMOTES: { id: EmoteType; label: string }[] = [
  { id: 'wave', label: 'Wave' },
  { id: 'dance', label: 'Dance' },
  { id: 'cheer', label: 'Cheer' },
  { id: 'clap', label: 'Clap' },
  { id: 'sit', label: 'Sit' },
];

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function GameHUD({ mobileInputRef, onInteract }: GameHUDProps) {
  const profile = useGameStore((s) => s.profile);
  const isAdmin = useGameStore((s) => s.isAdmin);
  const health = useGameStore((s) => s.health);
  const activeVehicleId = useGameStore((s) => s.activeVehicleId);
  const vehicles = useGameStore((s) => s.vehicles);
  const localSpeedKmh = useGameStore((s) => s.localSpeedKmh);
  const localAltitude = useGameStore((s) => s.localAltitude);
  const localPos = useGameStore((s) => s.localPos);
  const remotePlayers = useGameStore((s) => s.remotePlayers);
  const activeMissionId = useGameStore((s) => s.activeMissionId);
  const activeWorkShift = useGameStore((s) => s.activeWorkShift);
  const setActiveWorkShift = useGameStore((s) => s.setActiveWorkShift);
  const waypointTarget = useGameStore((s) => s.waypointTarget);
  const setWaypointTarget = useGameStore((s) => s.setWaypointTarget);
  const nearbyPrompt = useGameStore((s) => s.nearbyPrompt);
  const activePanel = useGameStore((s) => s.activePanel);
  const setActivePanel = useGameStore((s) => s.setActivePanel);
  const openBuildingPanel = useGameStore((s) => s.openBuildingPanel);
  const setShowWorldMapModal = useGameStore((s) => s.setShowWorldMapModal);
  const mingleEvent = useGameStore((s) => s.mingleEvent);
  const requestTeleport = useGameStore((s) => s.requestTeleport);
  const hudCollapsed = useGameStore((s) => s.hudCollapsed);
  const toggleHudCollapsed = useGameStore((s) => s.toggleHudCollapsed);
  const toasts = useGameStore((s) => s.toasts);
  const triggerEmote = useGameStore((s) => s.triggerEmote);
  const showMobileControls = useGameStore((s) => s.showMobileControls);
  const friendRequests = useGameStore((s) => s.friendRequests);
  const sessionReplacedMessage = useGameStore((s) => s.sessionReplacedMessage);
  const chatMessages = useGameStore((s) => s.chatMessages);
  const unreadChatCount = useGameStore((s) => s.unreadChatCount);
  const voiceJoined = useGameStore((s) => s.voiceJoined);
  const voiceMuted = useGameStore((s) => s.voiceMuted);
  const voiceMode = useGameStore((s) => s.voiceMode);
  const localSpeaking = useGameStore((s) => s.localSpeaking);
  const voicePeers = useGameStore((s) => s.voicePeers);

  const [showEmotes, setShowEmotes] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [adIdx, setAdIdx] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const a = window.setInterval(() => {
      setAdIdx((i) => (i + 1) % SHOWCASE_ADS.length);
    }, 7000);
    return () => window.clearInterval(a);
  }, []);

  if (!profile) return null;

  const activeMission = activeMissionId
    ? MISSIONS.find((m) => m.id === activeMissionId)
    : null;
  const activeVehicle = activeVehicleId ? vehicles[activeVehicleId] : null;
  const dailyUnclaimed = profile.lastDailyLoginDate !== getTodayDateKey();
  const mingleRemainingMs = Math.max(0, mingleEvent.nextEventAtMs - nowMs);
  const showMingleBanner =
    mingleEvent.alarmActive ||
    mingleRemainingMs <= 5 * 60 * 1000 ||
    Boolean(mingleEvent.activeMatch) ||
    Boolean(mingleEvent.selectedPair);
  const currentAd = SHOWCASE_ADS[adIdx % SHOWCASE_ADS.length];

  const togglePanel = (panel: NonNullable<typeof activePanel>) => {
    playSfx('click');
    setShowEmotes(false);
    setActivePanel(activePanel === panel ? null : panel);
  };

  const setMobileMove = (x: number, y: number) => {
    mobileInputRef.current.moveX = x;
    mobileInputRef.current.moveY = y;
  };

  const workDist = activeWorkShift
    ? Math.round(Math.hypot(localPos.x - activeWorkShift.target.x, localPos.z - activeWorkShift.target.z))
    : 0;
  const wpDist = waypointTarget
    ? Math.round(Math.hypot(localPos.x - waypointTarget.x, localPos.z - waypointTarget.z))
    : 0;

  const recentChat = chatMessages.slice(-3);
  const activeSpeakers = Object.values(voicePeers)
    .filter((p) => p.speaking)
    .map((p) => remotePlayers[p.uid]?.displayName || 'Player');

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none">
      {/* Duplicate Session Notice */}
      {sessionReplacedMessage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 pointer-events-auto">
          <div className="max-w-md w-full bg-[#101820] border border-amber-500/40 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-white">Session Replaced</h2>
            <p className="text-sm text-slate-300 leading-relaxed">{sessionReplacedMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Reconnect Session
            </button>
          </div>
        </div>
      )}

      {/* Top-Left Compact Player Profile, Daily Gift & Active Objective Strip */}
      {!hudCollapsed && (
        <div className="fixed top-4 left-4 flex flex-col gap-2 max-w-[305px] pointer-events-auto">
          <div className="bg-[#0b1014]/88 border border-white/12 rounded-xl px-3.5 py-2.5 flex items-center gap-3">
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-white/20 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center font-display font-bold text-white shrink-0">
                {profile.displayName[0]}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-bold text-white truncate">
                  {profile.displayName}
                </span>
                <span className="text-[11px] font-mono-nums text-slate-400 shrink-0">
                  {isAdmin ? <span className="text-amber-400 font-semibold mr-1.5">ADMIN</span> : null}
                  Lv.{profile.level}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px]">
                {profile.instagramId ? (
                  <span className="text-sky-300/90 truncate">@{profile.instagramId}</span>
                ) : (
                  <span className="text-slate-400 capitalize">{profile.appearance.gender}</span>
                )}
                <span className="text-[10px] text-rose-300 capitalize shrink-0">
                  {profile.relationshipStatus === 'married' && profile.partnerName
                    ? `♥ ${profile.partnerName}`
                    : `${profile.relationshipStatus} · ${profile.age}y`}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs pt-0.5">
                <button
                  type="button"
                  onClick={() => togglePanel('wallet')}
                  className="inline-flex items-center gap-1 font-mono-nums font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5" />
                  {isAdmin ? 'FREE · ' : ''}
                  {profile.greenCoins.toLocaleString()} GC
                </button>
                <div className="flex items-center gap-1.5 w-20">
                  <Heart className="w-3 h-3 text-rose-400 shrink-0" />
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${health}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Login Reward Quick Button */}
          <button
            type="button"
            onClick={() => togglePanel('daily_reward')}
            className={`rounded-xl px-3.5 py-2 flex items-center justify-between gap-2 text-left border transition-colors cursor-pointer ${
              dailyUnclaimed
                ? 'bg-amber-950/85 hover:bg-amber-900/85 border-amber-400/60 animate-pulse'
                : 'bg-[#0b1014]/82 hover:bg-[#101820] border-white/10'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Gift className={`w-4 h-4 shrink-0 ${dailyUnclaimed ? 'text-amber-300' : 'text-emerald-400'}`} />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {dailyUnclaimed ? 'Claim Daily Login Reward!' : `Daily Streak: Day ${profile.dailyLoginStreak || 1}`}
                </div>
                <div className="text-[10px] text-slate-300 truncate">
                  {dailyUnclaimed ? 'Free Green Coins + XP ready now' : 'Come back tomorrow for next bonus'}
                </div>
              </div>
            </div>
            {dailyUnclaimed && (
              <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-extrabold rounded shrink-0">
                CLAIM
              </span>
            )}
          </button>

          {activeWorkShift && (
            <div className="bg-[#0b1014]/88 border border-emerald-500/35 rounded-xl px-3.5 py-2 flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => togglePanel('works')}
                className="text-left min-w-0 flex-1 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-400 font-medium">
                  <span>Active Work Shift</span>
                  <span className="font-mono-nums">+{activeWorkShift.payout} GC</span>
                </div>
                <div className="text-xs font-semibold text-white truncate mt-0.5">
                  {activeWorkShift.title}
                </div>
                <div className="text-[11px] text-slate-300 truncate font-mono-nums">
                  {activeWorkShift.targetName} · {workDist}m away
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkShift(null)}
                aria-label="Cancel work shift"
                className="p-0.5 text-slate-400 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {waypointTarget && !activeWorkShift && (
            <div className="bg-[#0b1014]/88 border border-sky-500/35 rounded-xl px-3.5 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Navigation className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] text-sky-300 font-medium truncate">
                    Walk to {waypointTarget.label}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono-nums">
                    {wpDist}m away · Follow beacon
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaypointTarget(null)}
                aria-label="Clear waypoint"
                className="p-0.5 text-slate-400 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeMission && !activeWorkShift && !waypointTarget && (
            <button
              type="button"
              onClick={() => togglePanel('missions')}
              className="bg-[#0b1014]/84 hover:bg-[#101820] border border-amber-500/25 rounded-xl px-3.5 py-2 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] text-amber-400 font-medium">
                <span>Active Mission</span>
                <span className="font-mono-nums">+{activeMission.rewardCoins} GC</span>
              </div>
              <div className="text-xs font-semibold text-white truncate mt-0.5">
                {activeMission.title}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {activeMission.objectiveText}
              </div>
            </button>
          )}
        </div>
      )}

      {/* Top-Center Single-to-Mingle 5-Min Alarm & Selected Members DP Banner */}
      {!hudCollapsed && showMingleBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 pointer-events-auto max-w-[460px] w-[92vw]">
          <div className="bg-[#180c14]/92 border border-rose-400/50 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {mingleEvent.selectedPair ? (
                <div className="flex items-center -space-x-1.5 shrink-0">
                  <PlayerAvatarDP
                    displayName={mingleEvent.selectedPair.memberA.displayName}
                    photoURL={mingleEvent.selectedPair.memberA.photoURL}
                    appearance={mingleEvent.selectedPair.memberA.appearance}
                    gender={mingleEvent.selectedPair.memberA.gender}
                    size="xs"
                    ringClassName="ring-2 ring-rose-400"
                  />
                  <PlayerAvatarDP
                    displayName={mingleEvent.selectedPair.memberB.displayName}
                    photoURL={mingleEvent.selectedPair.memberB.photoURL}
                    appearance={mingleEvent.selectedPair.memberB.appearance}
                    gender={mingleEvent.selectedPair.memberB.gender}
                    size="xs"
                    ringClassName="ring-2 ring-pink-400"
                  />
                </div>
              ) : (
                <BellRing className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {mingleEvent.selectedPair
                    ? mingleEvent.selectedPair.status === 'honeymoon'
                      ? `Free Honeymoon: ${mingleEvent.selectedPair.memberA.displayName} ♥ ${mingleEvent.selectedPair.memberB.displayName}`
                      : mingleEvent.selectedPair.status === 'married'
                        ? `Just Married: ${mingleEvent.selectedPair.memberA.displayName} ♥ ${mingleEvent.selectedPair.memberB.displayName}`
                        : `Selected: ${mingleEvent.selectedPair.memberA.displayName} ♥ ${mingleEvent.selectedPair.memberB.displayName}`
                    : mingleEvent.activeMatch
                      ? `Match: ${mingleEvent.activeMatch.partnerName}`
                      : `Free Single-to-Mingle in ${formatCountdown(mingleRemainingMs)}`}
                </div>
                <div className="text-[10px] text-rose-200/90 truncate">
                  FREE · {mingleEvent.locationName}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActivePanel('mingle');
                }}
                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold rounded-lg cursor-pointer whitespace-nowrap"
              >
                {mingleEvent.selectedPair ? 'View DPs' : 'Open'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top-Right Live Radar Minimap + Compact Rotating Typixel Showcase Ad Card */}
      {!hudCollapsed && (
        <div className="fixed top-4 right-4 flex flex-col gap-2 items-end pointer-events-auto">
          <Minimap />

          {/* Compact Typixel Official Showcase Ad Card */}
          <a
            href={currentAd.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-[168px] bg-[#0b1014]/88 hover:bg-[#111b23] border border-white/12 hover:border-amber-400/45 rounded-xl overflow-hidden transition-colors block"
          >
            <div className="relative h-20 w-full bg-slate-900 overflow-hidden">
              <img
                src={currentAd.imageUrl}
                alt={currentAd.title}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/75 text-[9px] font-bold text-amber-300 rounded">
                AD · TYPIXEL
              </span>
            </div>
            <div className="px-2.5 py-1.5">
              <div className="text-[11px] font-bold text-white truncate">{currentAd.title}</div>
              <div className="flex items-center justify-between text-[9px] text-sky-300 mt-0.5">
                <span className="truncate">@typixelofficial</span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </div>
            </div>
          </a>
        </div>
      )}

      {/* Top-Center Toast Notifications */}
      {toasts.length > 0 && (
        <div
          className={`fixed ${showMingleBanner ? 'top-20' : 'top-4'} left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[340px] max-w-[90vw] pointer-events-none`}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="bg-[#0b1014]/94 border border-white/15 rounded-lg px-4 py-2.5 text-center"
            >
              <div
                className={`text-xs font-semibold ${
                  t.tone === 'emerald'
                    ? 'text-emerald-400'
                    : t.tone === 'amber'
                      ? 'text-amber-300'
                      : t.tone === 'rose'
                        ? 'text-rose-400'
                        : 'text-sky-300'
                }`}
              >
                {t.title}
              </div>
              {t.detail && <div className="text-[11px] text-slate-300 mt-0.5">{t.detail}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Bottom-Left Compact Voice Bar + Live Online Chat Ticker (when Chat panel is closed) */}
      {!hudCollapsed && activePanel !== 'chat' && !showMobileControls && (
        <div className="fixed bottom-24 left-4 flex flex-col gap-2 w-[310px] max-w-[calc(100vw-2rem)] pointer-events-auto">
          {voiceJoined && (
            <div className="bg-[#0b1014]/90 border border-emerald-500/40 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Volume2
                  className={`w-4 h-4 shrink-0 ${
                    localSpeaking || activeSpeakers.length > 0
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-white truncate">
                    {localSpeaking
                      ? 'You are speaking...'
                      : activeSpeakers.length > 0
                        ? `Talking: ${activeSpeakers.join(', ')}`
                        : `Voice Live (${Object.keys(voicePeers).length + 1} in voice)`}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {voiceMode === 'global' ? 'Global Voice' : 'Nearby Voice (45m)'} ·{' '}
                    {voiceMuted ? 'Mic Muted (V)' : 'Mic On (V)'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => voiceChat.toggleMute()}
                  aria-label={voiceMuted ? 'Unmute microphone' : 'Mute microphone'}
                  className={`p-1.5 rounded-lg cursor-pointer ${
                    voiceMuted
                      ? 'bg-amber-600/30 text-amber-300 hover:bg-amber-600/45'
                      : 'bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/45'
                  }`}
                >
                  {voiceMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => voiceChat.leaveVoice()}
                  aria-label="Leave voice chat"
                  className="p-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-300 cursor-pointer"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {recentChat.length > 0 && (
            <button
              type="button"
              onClick={() => togglePanel('chat')}
              className="bg-[#0b1014]/78 hover:bg-[#0e151b]/92 border border-white/10 rounded-xl px-3 py-2 text-left space-y-1 transition-colors cursor-pointer"
            >
              {recentChat.map((m) => (
                <div key={m.id} className="text-[11px] leading-snug truncate">
                  {m.channel === 'system' ? (
                    <span className="text-emerald-400/90 italic">{m.text}</span>
                  ) : (
                    <>
                      <span className="font-semibold text-white mr-1">
                        {m.channel === 'direct' ? `[DM] ${m.displayName}` : m.displayName}:
                      </span>
                      <span className="text-slate-300">{m.text}</span>
                    </>
                  )}
                </div>
              ))}
            </button>
          )}
        </div>
      )}

      {/* Proximity Interaction Prompt (Clickable + Keyboard [E]) */}
      {nearbyPrompt && !activeVehicle && !activePanel && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            type="button"
            onClick={onInteract}
            className="flex items-center gap-3 px-4 py-2.5 bg-[#0b1014]/92 hover:bg-[#132029] border border-emerald-500/45 rounded-xl transition-colors cursor-pointer"
          >
            <span className="w-7 h-7 rounded-md bg-emerald-600 text-white font-mono-nums text-xs font-bold flex items-center justify-center shrink-0">
              E
            </span>
            <div className="text-left">
              <div className="text-xs font-semibold text-white whitespace-nowrap">
                {nearbyPrompt.label}
              </div>
              {nearbyPrompt.sublabel && (
                <div className="text-[11px] text-slate-300 whitespace-nowrap">
                  {nearbyPrompt.sublabel}
                </div>
              )}
            </div>
          </button>
        </div>
      )}

      {/* Vehicle Speedometer (Only When Driving / Flying) */}
      {activeVehicle && (
        <div className="fixed bottom-24 right-5 bg-[#0b1014]/90 border border-white/15 rounded-xl px-4 py-3 min-w-[170px] pointer-events-auto">
          <div className="text-[11px] text-slate-400 truncate">{activeVehicle.name}</div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-display text-3xl font-extrabold font-mono-nums text-white">
              {localSpeedKmh}
            </span>
            <span className="text-xs text-emerald-400 font-medium">KM/H</span>
          </div>
          {activeVehicle.canFly && (
            <div className="text-[11px] font-mono-nums text-sky-300 mt-0.5">
              ALT {localAltitude}m · SPACE Up / SHIFT Down
            </div>
          )}
          <button
            type="button"
            onClick={onInteract}
            className="mt-2 w-full py-1.5 bg-white/8 hover:bg-white/14 text-xs font-medium text-slate-200 rounded-md cursor-pointer"
          >
            Press E to Exit Vehicle
          </button>
        </div>
      )}

      {/* Optional Mobile Touch Controls */}
      {showMobileControls && !activePanel && (
        <>
          <div className="fixed bottom-24 left-5 grid grid-cols-3 gap-1.5 w-36 pointer-events-auto">
            <div />
            <button
              type="button"
              onPointerDown={() => setMobileMove(0, 1)}
              onPointerUp={() => setMobileMove(0, 0)}
              onPointerLeave={() => setMobileMove(0, 0)}
              className="h-11 bg-[#0b1014]/85 border border-white/15 rounded-lg text-xs font-bold text-white active:bg-emerald-600"
            >
              W
            </button>
            <div />
            <button
              type="button"
              onPointerDown={() => setMobileMove(-1, 0)}
              onPointerUp={() => setMobileMove(0, 0)}
              onPointerLeave={() => setMobileMove(0, 0)}
              className="h-11 bg-[#0b1014]/85 border border-white/15 rounded-lg text-xs font-bold text-white active:bg-emerald-600"
            >
              A
            </button>
            <button
              type="button"
              onPointerDown={() => setMobileMove(0, -1)}
              onPointerUp={() => setMobileMove(0, 0)}
              onPointerLeave={() => setMobileMove(0, 0)}
              className="h-11 bg-[#0b1014]/85 border border-white/15 rounded-lg text-xs font-bold text-white active:bg-emerald-600"
            >
              S
            </button>
            <button
              type="button"
              onPointerDown={() => setMobileMove(1, 0)}
              onPointerUp={() => setMobileMove(0, 0)}
              onPointerLeave={() => setMobileMove(0, 0)}
              className="h-11 bg-[#0b1014]/85 border border-white/15 rounded-lg text-xs font-bold text-white active:bg-emerald-600"
            >
              D
            </button>
          </div>
          <div className="fixed bottom-24 right-5 flex flex-col gap-2 pointer-events-auto">
            <button
              type="button"
              onPointerDown={() => {
                mobileInputRef.current.jump = true;
              }}
              onPointerUp={() => {
                mobileInputRef.current.jump = false;
              }}
              onPointerLeave={() => {
                mobileInputRef.current.jump = false;
              }}
              className="px-4 py-3 bg-[#0b1014]/85 border border-white/15 rounded-lg text-xs font-bold text-white active:bg-emerald-600"
            >
              JUMP
            </button>
            <button
              type="button"
              onClick={onInteract}
              className="px-4 py-3 bg-emerald-600 text-white rounded-lg text-xs font-bold"
            >
              INTERACT
            </button>
          </div>
        </>
      )}

      {/* Emote Quick Picker Popover */}
      {showEmotes && !hudCollapsed && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#0b1014]/94 border border-white/15 rounded-xl p-2 flex items-center gap-1.5 pointer-events-auto">
          {EMOTES.map((em) => (
            <button
              key={em.id}
              type="button"
              onClick={() => {
                triggerEmote(em.id);
                setShowEmotes(false);
                playSfx('click');
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-white/5 hover:bg-emerald-600 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {em.label}
            </button>
          ))}
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock (Clean Normal-User Controls; Admin Hidden Unless Verified Admin) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 max-w-[96vw] pointer-events-auto">
        <button
          type="button"
          onClick={toggleHudCollapsed}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#0b1014]/85 hover:bg-[#121c24] border border-white/12 rounded-md text-[11px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          {hudCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show HUD (H)
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Hide HUD (H)
            </>
          )}
        </button>

        {!hudCollapsed && (
          <nav
            aria-label="Game Actions"
            className="bg-[#0b1014]/90 border border-white/12 rounded-xl px-2 py-1.5 flex items-center gap-1 overflow-x-auto max-w-[95vw]"
          >
            <DockButton
              icon={<MessageSquare className="w-4 h-4" />}
              label={unreadChatCount > 0 ? `Chat (${unreadChatCount})` : 'Chat'}
              active={activePanel === 'chat'}
              onClick={() => togglePanel('chat')}
            />
            <DockButton
              icon={
                voiceJoined && voiceMuted ? (
                  <MicOff className="w-4 h-4 text-amber-300" />
                ) : (
                  <Mic className={`w-4 h-4 ${voiceJoined ? 'text-white' : 'text-emerald-400'}`} />
                )
              }
              label={!voiceJoined ? 'Talk' : voiceMuted ? 'Muted' : 'Mic On'}
              active={voiceJoined && !voiceMuted}
              onClick={() => {
                playSfx('click');
                voiceChat.toggleMute();
              }}
            />
            <DockButton
              icon={<MapIcon className="w-4 h-4 text-emerald-400" />}
              label="Map"
              active={false}
              onClick={() => {
                playSfx('click');
                setShowWorldMapModal(true);
              }}
            />
            <DockButton
              icon={<Briefcase className="w-4 h-4" />}
              label="Works"
              active={activePanel === 'works'}
              onClick={() => togglePanel('works')}
            />
            <DockButton
              icon={<Home className="w-4 h-4" />}
              label="Homes"
              active={activePanel === 'properties'}
              onClick={() => togglePanel('properties')}
            />
            <DockButton
              icon={<Store className="w-4 h-4 text-rose-400" />}
              label="Tea & Shops"
              active={activePanel === 'shops'}
              onClick={() => togglePanel('shops')}
            />
            <DockButton
              icon={<Building2 className="w-4 h-4 text-sky-400" />}
              label="Buildings"
              active={activePanel === 'building'}
              onClick={() => {
                playSfx('click');
                if (activePanel === 'building') {
                  setActivePanel(null);
                } else {
                  openBuildingPanel('bldg-hospital');
                }
              }}
            />
            <DockButton
              icon={<Car className="w-4 h-4" />}
              label="KSRTC & Cars"
              active={activePanel === 'vehicles'}
              onClick={() => togglePanel('vehicles')}
            />
            <DockButton
              icon={<Heart className="w-4 h-4 text-rose-400" />}
              label="Mingle"
              active={activePanel === 'mingle'}
              onClick={() => togglePanel('mingle')}
            />
            <DockButton
              icon={<Package className="w-4 h-4" />}
              label="Bag"
              active={activePanel === 'inventory'}
              onClick={() => togglePanel('inventory')}
            />
            <DockButton
              icon={<Users className="w-4 h-4" />}
              label={friendRequests.length > 0 ? `Friends (${friendRequests.length})` : 'Friends'}
              active={activePanel === 'friends'}
              onClick={() => togglePanel('friends')}
            />
            <DockButton
              icon={<Smile className="w-4 h-4" />}
              label="Emotes"
              active={showEmotes}
              onClick={() => {
                playSfx('click');
                setShowEmotes((v) => !v);
              }}
            />
            {isAdmin && (
              <DockButton
                icon={<ShieldCheck className="w-4 h-4 text-amber-400" />}
                label="Admin"
                active={activePanel === 'admin'}
                onClick={() => togglePanel('admin')}
              />
            )}
            <DockButton
              icon={<Menu className="w-4 h-4" />}
              label="Menu"
              active={activePanel === 'pause'}
              onClick={() => togglePanel('pause')}
            />
          </nav>
        )}
      </div>

      {/* Modal & Drawer Game Panels */}
      <GamePanels />

      {/* Interactive Zoomable World Map Modal */}
      <WorldMapModal />
    </div>
  );
}

function DockButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
        active
          ? 'bg-emerald-600 text-white'
          : 'text-slate-300 hover:text-white hover:bg-white/8'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
