import { useRef } from 'react';
import { CheckCircle2, Compass, Crosshair, MapPin, ShieldAlert } from 'lucide-react';
import {
  FOOTBALL_PITCH_CENTER,
  HIDDEN_CARD_POS,
  PALACE_VILLAS,
  VOLLEYBALL_COURT_CENTER,
  isPositionOnRoad,
} from '../shared/worldData.ts';
import { useGameStore } from '../store/gameStore.ts';

interface PositionSelectorProps {
  x: number;
  z: number;
  clearance?: number;
  label?: string;
  onChange: (x: number, z: number) => void;
}

export function PositionSelector({
  x,
  z,
  clearance = 12,
  label = 'Plot Position Viewer & Selector',
  onChange,
}: PositionSelectorProps) {
  const villageHalfSize = useGameStore((s) => s.villageHalfSize);
  const localPos = useGameStore((s) => s.localPos);
  const customHomes = useGameStore((s) => s.customHomes);
  const customShops = useGameStore((s) => s.customShops);
  const palaceVillas = useGameStore((s) => s.palaceVillas);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);

  const range = Math.max(300, Math.min(villageHalfSize - 24, 520));
  const roadCheck = isPositionOnRoad(x, z, clearance);

  const clampCoord = (v: number) =>
    Math.round(Math.max(-villageHalfSize + 26, Math.min(villageHalfSize - 26, v)));

  const updateFromPointer = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const nz = ((clientY - rect.top) / rect.height) * 2 - 1;
    onChange(clampCoord(nx * range), clampCoord(nz * range));
  };

  const applyMySpot = () => {
    const dist = clearance >= 11 ? 15 : 10;
    const tx = clampCoord(localPos.x + Math.sin(localPos.rotY) * dist);
    const tz = clampCoord(localPos.z + Math.cos(localPos.rotY) * dist);
    onChange(tx, tz);
  };

  const findClearPreset = (baseX: number, baseZ: number) => {
    for (let i = 0; i < 12; i++) {
      const ox = baseX + (i % 4) * 24;
      const oz = baseZ + Math.floor(i / 4) * 24;
      if (!isPositionOnRoad(ox, oz, clearance).onRoad) {
        onChange(clampCoord(ox), clampCoord(oz));
        return;
      }
    }
    onChange(clampCoord(baseX), clampCoord(baseZ));
  };

  const villasList = Object.values(palaceVillas).length
    ? Object.values(palaceVillas)
    : PALACE_VILLAS;

  return (
    <div className="p-3 bg-[#0a1015] border border-white/12 rounded-xl space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span>{label}</span>
        </div>
        <span className="text-[11px] font-mono-nums text-slate-300">
          X: {Math.round(x)}m · Z: {Math.round(z)}m
        </span>
      </div>

      {/* Live Road Validation Status */}
      <div
        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-2 border ${
          roadCheck.onRoad
            ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
            : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
        }`}
      >
        {roadCheck.onRoad ? (
          <>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{roadCheck.reason || 'Blocked: Cannot build on a road!'} — Tap green land below.</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Valid Off-Road Plot — Clear to Construct!</span>
          </>
        )}
      </div>

      {/* Interactive Top-Down Plot Viewer */}
      <div className="relative rounded-lg overflow-hidden border border-white/12 bg-[#0d1f17]">
        <svg
          ref={svgRef}
          viewBox={`${-range} ${-range} ${range * 2} ${range * 2}`}
          className="w-full h-44 sm:h-48 block cursor-crosshair touch-none select-none"
          onPointerDown={(e) => {
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateFromPointer(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (!draggingRef.current) return;
            updateFromPointer(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            draggingRef.current = false;
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
          }}
        >
          {/* Green Buildable Meadow */}
          <rect x={-range} y={-range} width={range * 2} height={range * 2} fill="#143525" />

          {/* Subtle Plot Grid */}
          {[-400, -300, -200, -100, 0, 100, 200, 300, 400].map((g) => (
            <g key={g} opacity={0.14}>
              <line x1={g} y1={-range} x2={g} y2={range} stroke="#86efac" strokeWidth={1.5} />
              <line x1={-range} y1={g} x2={range} y2={g} stroke="#86efac" strokeWidth={1.5} />
            </g>
          ))}

          {/* Emerald Lake & River (No-Build Water) */}
          <ellipse cx={-115} cy={115} rx={72} ry={58} fill="#0c4a6e" stroke="#38bdf8" strokeWidth={2} />
          <path
            d="M -152 -120 Q -132 -60 -152 0 Q -172 50 -145 95"
            fill="none"
            stroke="#0c4a6e"
            strokeWidth={22}
          />

          {/* Main Highways & Ring Roads (Strict No-Build Crimson-Slate Zones) */}
          <rect x={-16} y={-range} width={32} height={range * 2} fill="#334155" stroke="#ef4444" strokeWidth={1.5} opacity={0.92} />
          <rect x={-range} y={-16} width={range * 2} height={32} fill="#334155" stroke="#ef4444" strokeWidth={1.5} opacity={0.92} />
          <rect x={-64} y={-120} width={16} height={240} fill="#334155" stroke="#ef4444" strokeWidth={1} opacity={0.78} />
          <rect x={48} y={-120} width={16} height={240} fill="#334155" stroke="#ef4444" strokeWidth={1} opacity={0.78} />
          <rect x={-120} y={-80} width={240} height={16} fill="#334155" stroke="#ef4444" strokeWidth={1} opacity={0.78} />
          <rect x={-120} y={64} width={240} height={16} fill="#334155" stroke="#ef4444" strokeWidth={1} opacity={0.78} />

          {/* Central Fountain Plaza */}
          <circle cx={0} cy={0} r={35} fill="#1e293b" stroke="#f59e0b" strokeWidth={2} />

          {/* Airport Runway */}
          <rect x={72} y={88} width={74} height={46} fill="#334155" stroke="#94a3b8" strokeWidth={1.5} />

          {/* Sports Complex */}
          <circle cx={FOOTBALL_PITCH_CENTER.x} cy={FOOTBALL_PITCH_CENTER.z} r={26} fill="#166534" stroke="#4ade80" strokeWidth={1.5} />
          <circle cx={VOLLEYBALL_COURT_CENTER.x} cy={VOLLEYBALL_COURT_CENTER.z} r={16} fill="#166534" stroke="#38bdf8" strokeWidth={1.5} />

          {/* High-Risk Cliff */}
          <circle cx={HIDDEN_CARD_POS.x} cy={HIDDEN_CARD_POS.z} r={42} fill="#3f1d2e" stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="6 4" />

          {/* Palace Villas Compounds */}
          {villasList.map((v) => (
            <g key={v.villaId}>
              <rect
                x={v.x - v.wallSize.w / 2 - 4}
                y={v.z - v.wallSize.d / 2 - 4}
                width={v.wallSize.w + 8}
                height={v.wallSize.d + 8}
                fill="#422006"
                stroke={v.accentColor}
                strokeWidth={2.5}
              />
            </g>
          ))}

          {/* Existing Custom Homes */}
          {Object.values(customHomes).map((ch) => (
            <rect
              key={ch.homeId}
              x={ch.x - 7}
              y={ch.z - 7}
              width={14}
              height={14}
              rx={2}
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth={1.2}
            />
          ))}

          {/* Existing Custom Shops */}
          {Object.values(customShops).map((sh) => (
            <circle
              key={sh.shopId}
              cx={sh.x}
              cy={sh.z}
              r={6}
              fill="#f43f5e"
              stroke="#ffffff"
              strokeWidth={1.2}
            />
          ))}

          {/* Player Current Position */}
          <circle cx={localPos.x} cy={localPos.z} r={7} fill="#38bdf8" stroke="#ffffff" strokeWidth={2} />

          {/* Selected Target Plot Marker */}
          <g transform={`translate(${x}, ${z})`}>
            <circle
              r={clearance + 5}
              fill={roadCheck.onRoad ? 'rgba(244,63,94,0.28)' : 'rgba(16,185,129,0.28)'}
              stroke={roadCheck.onRoad ? '#fb7185' : '#34d399'}
              strokeWidth={3}
            />
            <circle r={6} fill={roadCheck.onRoad ? '#f43f5e' : '#10b981'} stroke="#ffffff" strokeWidth={2} />
          </g>
        </svg>

        <div className="absolute bottom-1.5 left-2 flex items-center gap-2 text-[9px] bg-black/70 px-2 py-0.5 rounded text-slate-200 pointer-events-none">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Green = Build</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500 inline-block" /> Red = Road/No-Build</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> You</span>
        </div>
      </div>

      {/* Quick Presets & Fine Nudge */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={applyMySpot}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600/25 hover:bg-sky-600/40 border border-sky-400/40 text-sky-200 text-[11px] font-semibold rounded-md cursor-pointer"
          >
            <Crosshair className="w-3 h-3" />
            My Spot
          </button>
          <button
            type="button"
            onClick={() => findClearPreset(-210, -85)}
            className="px-2 py-1 bg-white/8 hover:bg-white/15 text-slate-200 text-[11px] rounded-md cursor-pointer"
          >
            Sunset Valley
          </button>
          <button
            type="button"
            onClick={() => findClearPreset(180, 175)}
            className="px-2 py-1 bg-white/8 hover:bg-white/15 text-slate-200 text-[11px] rounded-md cursor-pointer"
          >
            East Estates
          </button>
          <button
            type="button"
            onClick={() => findClearPreset(34, 28)}
            className="px-2 py-1 bg-white/8 hover:bg-white/15 text-slate-200 text-[11px] rounded-md cursor-pointer"
          >
            Near Plaza
          </button>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <Compass className="w-3 h-3 text-slate-400 mr-0.5" />
          <button
            type="button"
            onClick={() => onChange(clampCoord(x - 10), z)}
            className="px-1.5 py-0.5 bg-white/8 hover:bg-white/15 rounded text-slate-200 cursor-pointer"
          >
            W
          </button>
          <button
            type="button"
            onClick={() => onChange(clampCoord(x + 10), z)}
            className="px-1.5 py-0.5 bg-white/8 hover:bg-white/15 rounded text-slate-200 cursor-pointer"
          >
            E
          </button>
          <button
            type="button"
            onClick={() => onChange(x, clampCoord(z - 10))}
            className="px-1.5 py-0.5 bg-white/8 hover:bg-white/15 rounded text-slate-200 cursor-pointer"
          >
            N
          </button>
          <button
            type="button"
            onClick={() => onChange(x, clampCoord(z + 10))}
            className="px-1.5 py-0.5 bg-white/8 hover:bg-white/15 rounded text-slate-200 cursor-pointer"
          >
            S
          </button>
        </div>
      </div>
    </div>
  );
}
