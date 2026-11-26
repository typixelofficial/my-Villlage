import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Coins,
  Gamepad2,
  Heart,
  Home,
  Map as MapIcon,
  Menu,
  MessageSquare,
  Navigation,
  Phone,
  PhoneIncoming,
  PhoneOff,
  Search,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { useGameStore } from '../store/gameStore.ts';
import type { MobileInputState } from './WorldViewport.tsx';
import { Minimap } from './Minimap.tsx';
import { GamePanels } from './GamePanels.tsx';
import { WorldMapModal } from './WorldMapModal.tsx';
import { playSfx } from '../game/audio.ts';
import { multiplayer } from '../lib/multiplayer.ts';
import { voiceChat } from '../lib/voiceChat.ts';

interface GameHUDProps {
  mobileInputRef: React.MutableRefObject<MobileInputState>;
  onInteract: () => void;
}

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
  const lowHealthAlertDismissed = useGameStore((s) => s.lowHealthAlertDismissed);
  const setLowHealthAlertDismissed = useGameStore((s) => s.setLowHealthAlertDismissed);
  const activeVehicleId = useGameStore((s) => s.activeVehicleId);
  const vehicles = useGameStore((s) => s.vehicles);
  const localSpeedKmh = useGameStore((s) => s.localSpeedKmh);
  const localAltitude = useGameStore((s) => s.localAltitude);
  const localPos = useGameStore((s) => s.localPos);
  const activeWorkShift = useGameStore((s) => s.activeWorkShift);
  const setActiveWorkShift = useGameStore((s) => s.setActiveWorkShift);
  const waypointTarget = useGameStore((s) => s.waypointTarget);
  const setWaypointTarget = useGameStore((s) => s.setWaypointTarget);
  const nearbyPrompt = useGameStore((s) => s.nearbyPrompt);
  const activePanel = useGameStore((s) => s.activePanel);
  const setActivePanel = useGameStore((s) => s.setActivePanel);
  const setShowWorldMapModal = useGameStore((s) => s.setShowWorldMapModal);
  const mingleEvent = useGameStore((s) => s.mingleEvent);
  const hudCollapsed = useGameStore((s) => s.hudCollapsed);
  const toggleHudCollapsed = useGameStore((s) => s.toggleHudCollapsed);
  const toasts = useGameStore((s) => s.toasts);
  const showMobileControls = useGameStore((s) => s.showMobileControls);
  const sessionReplacedMessage = useGameStore((s) => s.sessionReplacedMessage);
  const unreadChatCount = useGameStore((s) => s.unreadChatCount);
  const unreadUpdatesCount = useGameStore((s) => s.unreadUpdatesCount);
  const phoneCall = useGameStore((s) => s.phoneCall);
  const voiceJoined = useGameStore((s) => s.voiceJoined);
  const pushToast = useGameStore((s) => s.pushToast);

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (!profile) return null;

  const activeVehicle = activeVehicleId ? vehicles[activeVehicleId] : null;
  const mingleRemainingMs = Math.max(0, mingleEvent.nextEventAtMs - nowMs);
  const showMingleBanner =
    mingleEvent.alarmActive || Boolean(mingleEvent.selectedPair);
  const showLowHealthAlert = health < 50 && !lowHealthAlertDismissed;

  const togglePanel = (panel: NonNullable<typeof activePanel>) => {
    playSfx('click');
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

      {/* Minimalist Top-Left Essentials Card (Name, Coins, Health + Low HP Hospital Alert) */}
      {!hudCollapsed && (
        <div className="fixed top-4 left-4 flex flex-col gap-2 max-w-[270px] pointer-events-auto">
          <div className="bg-[#0b1014]/86 border border-white/12 rounded-xl px-3.5 py-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-sm font-bold text-white truncate">
                {profile.displayName}
              </span>
              <span className="text-[11px] font-mono-nums text-slate-400 shrink-0">
                {isAdmin ? <span className="text-amber-400 font-bold mr-1">ADMIN</span> : null}
                Lv.{profile.level}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 text-xs">
              <button
                type="button"
                onClick={() => togglePanel('wallet')}
                className="inline-flex items-center gap-1 font-mono-nums font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5" />
                {profile.greenCoins.toLocaleString()} GC
              </button>
              <div className="flex items-center gap-1.5 w-24">
                <Heart
                  className={`w-3.5 h-3.5 shrink-0 ${
                    health < 50 ? 'text-rose-500 animate-pulse' : 'text-emerald-400'
                  }`}
                />
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      health < 50
                        ? 'bg-rose-500'
                        : health < 75
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${health}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono-nums text-slate-300">{health}%</span>
              </div>
            </div>
          </div>

          {/* Urgent <50% Health Hospital Alert */}
          {showLowHealthAlert && (
            <div className="bg-rose-950/92 border border-rose-400/70 rounded-xl px-3 py-2.5 space-y-2 shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                  <span>Low Health ({health}%)!</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLowHealthAlertDismissed(true)}
                  aria-label="Dismiss health alert"
                  className="text-rose-300 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-rose-100/90 leading-snug">
                Visit Green Valley Hospital or grab hot chai to recover HP.
              </p>
              <button
                type="button"
                onClick={() => {
                  setWaypointTarget({ x: 16, z: -86, label: 'Green Valley Central Hospital' });
                  pushToast('Hospital Waypoint Set', 'Follow the sky beacon to Central Hospital!', 'rose');
                }}
                className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold rounded-lg cursor-pointer"
              >
                Navigate to Hospital
              </button>
            </div>
          )}

          {/* Active Work Shift Pill (Only when on a shift) */}
          {activeWorkShift && (
            <div className="bg-[#0b1014]/88 border border-emerald-500/35 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => togglePanel('works')}
                className="text-left min-w-0 flex-1 cursor-pointer"
              >
                <div className="text-[11px] font-semibold text-emerald-400 truncate">
                  {activeWorkShift.title} (+{activeWorkShift.payout} GC)
                </div>
                <div className="text-[10px] text-slate-300 font-mono-nums truncate">
                  {activeWorkShift.targetName} · {workDist}m
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

          {/* Active Compass Waypoint Pill */}
          {waypointTarget && !activeWorkShift && (
            <div className="bg-[#0b1014]/88 border border-sky-500/35 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Navigation className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] text-sky-300 font-semibold truncate">
                    {waypointTarget.label}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono-nums">{wpDist}m away</div>
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
        </div>
      )}

      {/* Incoming Private Smartphone Call Toast */}
      {phoneCall && phoneCall.status === 'ringing_in' && activePanel !== 'phone' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[360px] w-[92vw]">
          <div className="bg-[#0c1b16]/95 border border-emerald-400/60 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-2xl">
            <div className="flex items-center gap-2.5 min-w-0">
              <PhoneIncoming className="w-5 h-5 text-emerald-400 animate-bounce shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{phoneCall.peerName}</div>
                <div className="text-[10px] text-emerald-300">Incoming Private Phone Call</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  multiplayer.acceptCall(phoneCall.callId);
                  if (!voiceJoined) void voiceChat.joinVoice();
                  setActivePanel('phone');
                }}
                className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl cursor-pointer"
                aria-label="Accept call"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => multiplayer.declineCall(phoneCall.callId)}
                className="p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl cursor-pointer"
                aria-label="Decline call"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact Mingle Live Alarm Banner (Only when active) */}
      {!hudCollapsed && showMingleBanner && phoneCall?.status !== 'ringing_in' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 pointer-events-auto max-w-[400px] w-[90vw]">
          <div className="bg-[#180c14]/90 border border-rose-400/50 rounded-xl px-3.5 py-2 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <BellRing className="w-4 h-4 text-rose-400 shrink-0" />
              <div className="text-xs font-bold text-white truncate">
                {mingleEvent.selectedPair
                  ? `${mingleEvent.selectedPair.memberA.displayName} ♥ ${mingleEvent.selectedPair.memberB.displayName}`
                  : `Mingle Round: ${formatCountdown(mingleRemainingMs)}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActivePanel('mingle')}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold rounded-lg cursor-pointer shrink-0"
            >
              Open
            </button>
          </div>
        </div>
      )}

      {/* Top-Right Compact Minimap Only */}
      {!hudCollapsed && (
        <div className="fixed top-4 right-4 pointer-events-auto">
          <Minimap />
        </div>
      )}

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 flex flex-col gap-1.5 w-[320px] max-w-[90vw] pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="bg-[#0b1014]/94 border border-white/15 rounded-lg px-3.5 py-2 text-center"
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

      {/* Centered Proximity Interaction Prompt */}
      {nearbyPrompt && !activeVehicle && !activePanel && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 pointer-events-auto">
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

      {/* Compact Vehicle Speedometer (Only While Driving) */}
      {activeVehicle && (
        <div className="fixed bottom-24 right-5 bg-[#0b1014]/90 border border-white/15 rounded-xl px-4 py-3 min-w-[165px] pointer-events-auto">
          <div className="text-[11px] text-slate-400 truncate">{activeVehicle.name}</div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-display text-3xl font-extrabold font-mono-nums text-white">
              {localSpeedKmh}
            </span>
            <span className="text-xs text-emerald-400 font-medium">KM/H</span>
          </div>
          {activeVehicle.canFly && (
            <div className="text-[11px] font-mono-nums text-sky-300 mt-0.5">
              ALT {localAltitude}m
            </div>
          )}
          <button
            type="button"
            onClick={onInteract}
            className="mt-2 w-full py-1.5 bg-white/8 hover:bg-white/14 text-xs font-medium text-slate-200 rounded-md cursor-pointer"
          >
            Exit Vehicle (E)
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

      {/* Clean Minimalist Bottom Dock — Essential Controls Only */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 max-w-[96vw] pointer-events-auto">
        <button
          type="button"
          onClick={toggleHudCollapsed}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#0b1014]/80 hover:bg-[#121c24] border border-white/12 rounded-md text-[10px] font-medium text-slate-300 hover:text-white cursor-pointer"
        >
          {hudCollapsed ? (
            <>
              <ChevronUp className="w-3 h-3" />
              HUD
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Hide
            </>
          )}
        </button>

        {!hudCollapsed && (
          <nav
            aria-label="Essential Controls"
            className="bg-[#0b1014]/90 border border-white/12 rounded-xl px-2 py-1.5 flex items-center gap-1 overflow-x-auto max-w-[95vw]"
          >
            <DockButton
              icon={<Smartphone className="w-4 h-4 text-emerald-400" />}
              label={
                phoneCall
                  ? 'In Call'
                  : unreadUpdatesCount > 0
                    ? `Phone (${unreadUpdatesCount})`
                    : 'Phone'
              }
              active={activePanel === 'phone' || Boolean(phoneCall)}
              onClick={() => togglePanel('phone')}
            />
            <DockButton
              icon={<MapIcon className="w-4 h-4 text-sky-400" />}
              label="Map"
              active={false}
              onClick={() => {
                playSfx('click');
                setShowWorldMapModal(true);
              }}
            />
            <DockButton
              icon={<Search className="w-4 h-4 text-sky-300" />}
              label="Search"
              active={activePanel === 'search'}
              onClick={() => togglePanel('search')}
            />
            <DockButton
              icon={<Briefcase className="w-4 h-4 text-amber-300" />}
              label="Works"
              active={activePanel === 'works'}
              onClick={() => togglePanel('works')}
            />
            <DockButton
              icon={<Home className="w-4 h-4 text-emerald-300" />}
              label="Build"
              active={activePanel === 'properties' || activePanel === 'shops'}
              onClick={() => togglePanel('properties')}
            />
            <DockButton
              icon={<Gamepad2 className="w-4 h-4 text-purple-400" />}
              label="Games"
              active={activePanel === 'game_center'}
              onClick={() => togglePanel('game_center')}
            />
            <DockButton
              icon={<MessageSquare className="w-4 h-4 text-slate-200" />}
              label={unreadChatCount > 0 ? `Chat (${unreadChatCount})` : 'Chat'}
              active={activePanel === 'chat'}
              onClick={() => togglePanel('chat')}
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
              icon={<Menu className="w-4 h-4 text-slate-200" />}
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
