import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Coins,
  Compass,
  Gamepad2,
  KeyRound,
  Lock,
  Search,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import type { MiniGameDef } from '../shared/types.ts';
import {
  GAME_CENTER_GAMES,
  HIDDEN_CARD_CLUES,
  HIDDEN_CARD_POS,
} from '../shared/worldData.ts';
import { useGameStore } from '../store/gameStore.ts';
import { multiplayer } from '../lib/multiplayer.ts';

const CATEGORIES = [
  'All',
  'Arcade',
  'Reflex',
  'Math',
  'Memory',
  'Trivia',
  'Sports',
  'Word',
  'Strategy',
  'Dice & Cards',
  'Tycoon',
] as const;

const TRIVIA_BANK = [
  { q: 'Which state is famous for KSRTC Super Fast red-and-yellow buses?', opts: ['Kerala', 'Goa', 'Punjab', 'Assam'], ans: 0 },
  { q: 'What currency do citizens earn in Green Valley?', opts: ['Gold Bars', 'Green Coins', 'Silver Tokens', 'Gems'], ans: 1 },
  { q: 'Which planet is known as the Red Planet?', opts: ['Venus', 'Jupiter', 'Mars', 'Saturn'], ans: 2 },
  { q: 'How many players are on a standard football team on the pitch?', opts: ['9', '10', '11', '12'], ans: 2 },
  { q: 'What is the capital city of Japan?', opts: ['Seoul', 'Kyoto', 'Osaka', 'Tokyo'], ans: 3 },
  { q: 'Which gas do green trees release during photosynthesis?', opts: ['Oxygen', 'Nitrogen', 'Helium', 'Argon'], ans: 0 },
  { q: 'Which popular snack is served hot at Kerala Chaya Kadas?', opts: ['Tacos', 'Pazham Pori', 'Pretzel', 'Sushi'], ans: 1 },
  { q: 'How many points is a volleyball set normally played to?', opts: ['15', '21', '25', '30'], ans: 2 },
  { q: 'Which ocean is the largest on Earth?', opts: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], ans: 3 },
  { q: 'What color is the emerald gemstone?', opts: ['Green', 'Blue', 'Red', 'Yellow'], ans: 0 },
];

const WORD_BANK = [
  { word: 'VALLEY', hint: 'Lush home of Green Valley' },
  { word: 'PALACE', hint: 'Largest royal house tier' },
  { word: 'SOCCER', hint: 'Played on the stadium pitch' },
  { word: 'SAMOVAR', hint: 'Traditional Kerala tea urn' },
  { word: 'TYPIXEL', hint: 'Official studio name' },
  { word: 'ARCADE', hint: 'Place with 50+ mini-games' },
  { word: 'BRIDGE', hint: 'Crosses over the river' },
  { word: 'CLIFF', hint: 'High-risk ridge with the VIP card' },
  { word: 'VOLLEY', hint: 'Net court sport in Sports Complex' },
  { word: 'EMERALD', hint: 'Green jewel of the highway' },
];

function getCompassDir(dx: number, dz: number): string {
  const angle = (Math.atan2(dx, -dz) * 180) / Math.PI;
  const norm = (angle + 360) % 360;
  const dirs = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
  return dirs[Math.round(norm / 45) % 8];
}

export function GameCenterModal() {
  const setActivePanel = useGameStore((s) => s.setActivePanel);
  const setWaypointTarget = useGameStore((s) => s.setWaypointTarget);
  const pushToast = useGameStore((s) => s.pushToast);
  const profile = useGameStore((s) => s.profile);
  const isAdmin = useGameStore((s) => s.isAdmin);
  const localPos = useGameStore((s) => s.localPos);

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [search, setSearch] = useState('');
  const [activeGame, setActiveGame] = useState<MiniGameDef | null>(null);
  const [roundNonce, setRoundNonce] = useState(0);

  const filteredGames = useMemo(() => {
    const q = search.trim().toLowerCase();
    return GAME_CENTER_GAMES.filter((g) => {
      if (category !== 'All' && g.category !== category) return false;
      if (!q) return true;
      return g.title.toLowerCase().includes(q) || g.tagline.toLowerCase().includes(q);
    });
  }, [category, search]);

  if (!profile) return null;

  const unlocked = Boolean(profile.hasGameCenterCard || isAdmin);
  const dx = HIDDEN_CARD_POS.x - localPos.x;
  const dz = HIDDEN_CARD_POS.z - localPos.z;
  const cardDist = Math.round(Math.hypot(dx, dz));
  const cardDir = getCompassDir(dx, dz);

  const handleFinishGame = (game: MiniGameDef, won: boolean) => {
    multiplayer.playGameCenterGame(game.id, won);
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4 pointer-events-auto">
      <div className="w-full max-w-3xl max-h-[86vh] bg-[#0d131a] border border-purple-500/35 rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 shrink-0 bg-[#111824]">
          <div className="flex items-center gap-3 min-w-0">
            <Gamepad2 className="w-6 h-6 text-purple-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-white truncate">
                Typixel Grand Game Center ({GAME_CENTER_GAMES.length} Games)
              </h2>
              <p className="text-xs text-slate-400 truncate">
                {unlocked
                  ? 'VIP Entrance Card Verified · Cheap Arcade Rates (5–15 GC)'
                  : 'VIP Entrance Card Required — Follow the High-Risk Clues to Unlock!'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-950/70 border border-emerald-500/35 rounded-lg text-xs font-mono-nums font-bold text-emerald-300">
              <Coins className="w-3.5 h-3.5" />
              {profile.greenCoins.toLocaleString()} GC
            </span>
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              aria-label="Close game center"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {!unlocked ? (
            /* LOCKED HIGH-RISK HIDDEN CARD GATE */
            <div className="max-w-xl mx-auto space-y-5 py-2">
              <div className="p-5 bg-gradient-to-br from-purple-950/60 via-[#151324] to-[#0f1620] border border-purple-400/40 rounded-2xl text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-600/25 border border-purple-400/50 flex items-center justify-center">
                  <Lock className="w-7 h-7 text-purple-300" />
                </div>
                <h3 className="font-display text-xl font-extrabold text-white">
                  Collect the Hidden VIP Entrance Card First!
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Entry to the <strong className="text-white">54-Game Mega Arcade</strong> is locked.
                  Find the spinning Golden VIP Card hidden on a dangerous high-risk mountain peak in Green Valley.
                  Once collected, you unlock permanent entry and super cheap 5–15 GC game rates!
                </p>
              </div>

              {/* Live Compass Distance Radar */}
              <div className="p-4 bg-[#121b24] border border-amber-400/35 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Compass className="w-6 h-6 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-amber-300">
                      Card Signal Radar: {cardDist}m to the {cardDir}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Watch your Health on the steep cliff — falling causes heavy HP damage!
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setWaypointTarget({
                      x: -172,
                      z: -214,
                      label: 'Danger Peak Cliff Trailhead',
                    });
                    pushToast(
                      'Cliff Trailhead Marked',
                      'Follow the sky beacon North-West and climb to the summit!',
                      'amber',
                    );
                    setActivePanel(null);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-lg cursor-pointer shrink-0"
                >
                  Set Trailhead Waypoint
                </button>
              </div>

              {/* Progressive Clues */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" />
                  Secret Clues to Find the Entrance Card
                </div>
                {HIDDEN_CARD_CLUES.map((clue, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#121922] border border-white/10 rounded-xl text-xs text-slate-200 leading-relaxed"
                  >
                    {clue}
                  </div>
                ))}
              </div>
            </div>
          ) : activeGame ? (
            /* ACTIVE MINI-GAME ARENA */
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveGame(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/8 hover:bg-white/15 text-slate-200 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  All 54 Games
                </button>
                <div className="text-xs font-mono-nums text-slate-300">
                  Entry: <span className="text-amber-300 font-bold">{isAdmin ? 'FREE' : `${activeGame.entryFee} GC`}</span> ·
                  Win Prize: <span className="text-emerald-400 font-bold">+{activeGame.winPrize} GC</span>
                </div>
              </div>

              <MiniGameArena
                key={`${activeGame.id}_${roundNonce}`}
                game={activeGame}
                canAfford={isAdmin || profile.greenCoins >= activeGame.entryFee}
                onComplete={(won) => handleFinishGame(activeGame, won)}
                onReplay={() => setRoundNonce((n) => n + 1)}
              />
            </div>
          ) : (
            /* 54-GAME CATALOG */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search 54 playable arcade games..."
                    className="w-full pl-9 pr-3 py-2 bg-[#131c26] border border-white/12 focus:border-purple-400 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
                  />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-950/50 border border-purple-400/35 rounded-xl text-xs font-bold text-purple-200 shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  VIP Cheap Rate Active
                </span>
              </div>

              {/* Category Filter Strip */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer shrink-0 border ${
                      category === cat
                        ? 'bg-purple-600 border-purple-400 text-white'
                        : 'bg-[#121a23] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Games Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredGames.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setActiveGame(g);
                      setRoundNonce((n) => n + 1);
                    }}
                    className="p-3.5 bg-[#121a23] hover:bg-[#182330] border border-white/10 hover:border-purple-400/50 rounded-xl text-left flex flex-col justify-between gap-3 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${g.accent}24`, color: g.accent }}
                        >
                          {g.category}
                        </span>
                        <span className="text-[11px] font-mono-nums font-bold text-emerald-400">
                          Win +{g.winPrize} GC
                        </span>
                      </div>
                      <div className="font-display text-sm font-bold text-white">{g.title}</div>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{g.tagline}</p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/8">
                      <span className="font-mono-nums text-amber-300 font-semibold">
                        {isAdmin ? 'FREE' : `${g.entryFee} GC Entry`}
                      </span>
                      <span className="text-purple-300 font-bold">Play →</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================ */
/* UNIVERSAL 10-ENGINE PLAYABLE MINI-GAME ARENA                                 */
/* ============================================================================ */
function MiniGameArena({
  game,
  canAfford,
  onComplete,
  onReplay,
}: {
  game: MiniGameDef;
  canAfford: boolean;
  onComplete: (won: boolean) => void;
  onReplay: () => void;
}) {
  const [result, setResult] = useState<'playing' | 'won' | 'lost'>('playing');
  const [statusMsg, setStatusMsg] = useState(game.tagline);
  const completedRef = useRef(false);

  const finish = (won: boolean, msg: string) => {
    if (completedRef.current) return;
    completedRef.current = true;
    setResult(won ? 'won' : 'lost');
    setStatusMsg(msg);
    onComplete(won);
  };

  // --- Engine 1: Reflex ---
  const [reflexPhase, setReflexPhase] = useState<'wait' | 'go'>('wait');
  const reflexGoAtRef = useRef(0);
  useEffect(() => {
    if (game.engine !== 'reflex' || result !== 'playing') return;
    const delay = 1200 + Math.random() * 2000;
    const t = window.setTimeout(() => {
      reflexGoAtRef.current = performance.now();
      setReflexPhase('go');
    }, delay);
    return () => window.clearTimeout(t);
  }, [game.engine, result]);

  // --- Engine 2: Timing Bar ---
  const [barPos, setBarPos] = useState(10);
  useEffect(() => {
    if (game.engine !== 'timing' || result !== 'playing') return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = (now - start) / 1000;
      setBarPos(50 + Math.sin(t * 3.8) * 46);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [game.engine, result]);

  // --- Engine 3: Math (3 questions) ---
  const [mathStep, setMathStep] = useState(0);
  const mathQ = useMemo(() => {
    const a = 4 + Math.floor(Math.random() * 14);
    const b = 3 + Math.floor(Math.random() * 11);
    const ops = ['+', '-', '×'] as const;
    const op = ops[(mathStep + game.id.length) % 3];
    const ans = op === '+' ? a + b : op === '-' ? a - b : a * b;
    const set = new Set<number>([ans]);
    while (set.size < 4) set.add(ans + Math.floor(Math.random() * 11) - 5);
    return { text: `${a} ${op} ${b} = ?`, ans, opts: Array.from(set).sort(() => Math.random() - 0.5) };
  }, [mathStep, game.id]);

  // --- Engine 4: Memory (6 pairs) ---
  const [memCards] = useState(() =>
    ['☕', '⚽', '🏆', '💎', '🚌', '🌴', '☕', '⚽', '🏆', '💎', '🚌', '🌴'].sort(
      () => Math.random() - 0.5,
    ),
  );
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [flipsLeft, setFlipsLeft] = useState(16);

  const handleFlipCard = (idx: number) => {
    if (result !== 'playing' || flipped.length >= 2 || flipped.includes(idx) || matched.includes(idx)) return;
    const nextFlipped = [...flipped, idx];
    setFlipped(nextFlipped);
    if (nextFlipped.length === 2) {
      const nextFlips = flipsLeft - 1;
      setFlipsLeft(nextFlips);
      const [a, b] = nextFlipped;
      if (memCards[a] === memCards[b]) {
        const nextMatched = [...matched, a, b];
        setMatched(nextMatched);
        setFlipped([]);
        if (nextMatched.length === memCards.length) {
          finish(true, 'All 6 pairs matched cleanly!');
        }
      } else {
        window.setTimeout(() => {
          setFlipped([]);
          if (nextFlips <= 0) finish(false, 'Out of flips! Try again.');
        }, 550);
      }
    }
  };

  // --- Engine 5: Clicker (20 taps in 8s) ---
  const [clicks, setClicks] = useState(0);
  const [clickTime, setClickTime] = useState(8);
  const [clickStarted, setClickStarted] = useState(false);
  useEffect(() => {
    if (game.engine !== 'clicker' || !clickStarted || result !== 'playing') return;
    const id = window.setInterval(() => {
      setClickTime((prev) => {
        if (prev <= 1) {
          finish(false, 'Time expired! Tap faster next round.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [game.engine, clickStarted, result]);

  // --- Engine 6: Trivia (2 questions) ---
  const [triviaPair] = useState(() => {
    const shuffled = [...TRIVIA_BANK].sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]];
  });
  const [triviaIdx, setTriviaIdx] = useState(0);

  // --- Engine 7: RPS (Best of 3) ---
  const [rpsScore, setRpsScore] = useState({ me: 0, bot: 0 });
  const rpsMoves = useMemo(() => {
    if (game.id === 'gc-38') return ['Fire', 'Water', 'Forest'];
    if (game.id === 'gc-39') return ['Knight', 'Archer', 'Mage'];
    if (game.id === 'gc-40') return ['Shield', 'Hack', 'Patch'];
    if (game.id === 'gc-41') return ['Strike', 'Block', 'Throw'];
    return ['Rock', 'Paper', 'Scissors'];
  }, [game.id]);

  // --- Engine 8: Guess (1-20 in 4 tries) ---
  const [secretNum] = useState(() => 1 + Math.floor(Math.random() * 20));
  const [guessInput, setGuessInput] = useState('');
  const [guessTries, setGuessTries] = useState(4);
  const [guessHint, setGuessHint] = useState('Guess a number between 1 and 20.');

  // --- Engine 9: Word Scramble ---
  const [wordPick] = useState(() => {
    const w = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    const scrambled = w.word
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
    return { ...w, scrambled: scrambled === w.word ? w.word.split('').reverse().join('') : scrambled };
  });
  const [wordGuess, setWordGuess] = useState('');

  // --- Engine 10: Dice ---
  const [diceRoll, setDiceRoll] = useState<[number, number] | null>(null);

  if (!canAfford && result === 'playing') {
    return (
      <div className="p-6 bg-[#131b25] border border-rose-500/35 rounded-2xl text-center space-y-2">
        <div className="text-sm font-bold text-rose-300">Not enough Green Coins</div>
        <p className="text-xs text-slate-300">
          Need {game.entryFee} GC to play {game.title}. Earn coins via Works or Weekly Reward!
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 bg-[#121a24] border border-white/12 rounded-2xl space-y-4">
      <div className="text-center space-y-1">
        <h3 className="font-display text-lg font-extrabold text-white">{game.title}</h3>
        <p className="text-xs text-slate-300">{statusMsg}</p>
      </div>

      {result !== 'playing' ? (
        <div
          className={`p-5 rounded-xl border text-center space-y-3 ${
            result === 'won'
              ? 'bg-emerald-950/55 border-emerald-400/50'
              : 'bg-rose-950/45 border-rose-500/40'
          }`}
        >
          <Trophy
            className={`w-8 h-8 mx-auto ${result === 'won' ? 'text-amber-300' : 'text-slate-500'}`}
          />
          <div className="font-display text-lg font-extrabold text-white">
            {result === 'won' ? `You Won +${game.winPrize} Green Coins!` : 'Round Lost — Try Again!'}
          </div>
          <p className="text-xs text-slate-300">{statusMsg}</p>
          <button
            type="button"
            onClick={onReplay}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Play Again
          </button>
        </div>
      ) : (
        <div className="py-2">
          {game.engine === 'reflex' && (
            <button
              type="button"
              onClick={() => {
                if (reflexPhase === 'wait') {
                  finish(false, 'Too early! Wait for emerald green.');
                } else {
                  const ms = Math.round(performance.now() - reflexGoAtRef.current);
                  if (ms <= 460) finish(true, `Lightning reaction: ${ms}ms!`);
                  else finish(false, `Reaction was ${ms}ms (need ≤ 460ms).`);
                }
              }}
              className={`w-full py-12 rounded-2xl font-display text-xl font-extrabold text-white transition-colors cursor-pointer ${
                reflexPhase === 'go'
                  ? 'bg-emerald-500 hover:bg-emerald-400'
                  : 'bg-rose-700 hover:bg-rose-600'
              }`}
            >
              {reflexPhase === 'go' ? 'TAP NOW!' : 'WAIT FOR GREEN...'}
            </button>
          )}

          {game.engine === 'timing' && (
            <div className="space-y-4 max-w-md mx-auto">
              <div className="relative h-10 bg-[#0a1015] border border-white/15 rounded-xl overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 bg-emerald-500/35 border-x-2 border-emerald-400"
                  style={{ left: '40%', width: '20%' }}
                />
                <div
                  className="absolute top-0 bottom-0 w-2 bg-amber-300 shadow"
                  style={{ left: `calc(${barPos}% - 4px)` }}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (barPos >= 40 && barPos <= 60) finish(true, 'Perfect Bullseye Lock!');
                  else finish(false, 'Missed the green target zone!');
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl cursor-pointer"
              >
                LOCK TARGET!
              </button>
            </div>
          )}

          {game.engine === 'math' && (
            <div className="max-w-sm mx-auto space-y-3 text-center">
              <div className="text-[11px] text-slate-400">Question {mathStep + 1} of 3</div>
              <div className="font-display text-3xl font-extrabold text-white py-2">{mathQ.text}</div>
              <div className="grid grid-cols-2 gap-2.5">
                {mathQ.opts.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      if (opt !== mathQ.ans) {
                        finish(false, `Wrong answer! Correct was ${mathQ.ans}.`);
                      } else if (mathStep >= 2) {
                        finish(true, 'Solved all 3 equations!');
                      } else {
                        setMathStep((s) => s + 1);
                      }
                    }}
                    className="py-3 bg-[#1a2533] hover:bg-purple-600 text-white font-mono-nums font-bold text-base rounded-xl border border-white/10 cursor-pointer"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {game.engine === 'memory' && (
            <div className="max-w-sm mx-auto space-y-3">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Matched: {matched.length / 2} / 6</span>
                <span className="font-mono-nums text-amber-300">Flips Left: {flipsLeft}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {memCards.map((icon, idx) => {
                  const shown = flipped.includes(idx) || matched.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleFlipCard(idx)}
                      className={`h-14 rounded-xl text-2xl font-bold border transition-colors cursor-pointer ${
                        matched.includes(idx)
                          ? 'bg-emerald-900/50 border-emerald-400'
                          : shown
                            ? 'bg-purple-700/40 border-purple-400'
                            : 'bg-[#1a2533] border-white/10 hover:border-white/30'
                      }`}
                    >
                      {shown ? icon : '?'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {game.engine === 'clicker' && (
            <div className="max-w-sm mx-auto text-center space-y-3">
              <div className="flex justify-between text-xs font-mono-nums text-slate-300">
                <span>Score: {clicks} / 20</span>
                <span className="text-amber-300">{clickTime}s Left</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!clickStarted) setClickStarted(true);
                  const next = clicks + 1;
                  setClicks(next);
                  if (next >= 20) finish(true, `Smashed 20 taps with ${clickTime}s to spare!`);
                }}
                className="w-full py-10 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:scale-95 text-white font-display text-xl font-extrabold rounded-2xl cursor-pointer transition-transform"
              >
                TAP FAST! ({clicks}/20)
              </button>
            </div>
          )}

          {game.engine === 'trivia' && (
            <div className="max-w-md mx-auto space-y-3">
              <div className="text-[11px] text-purple-300 font-semibold">
                Trivia Question {triviaIdx + 1} of 2
              </div>
              <div className="text-sm font-bold text-white">{triviaPair[triviaIdx].q}</div>
              <div className="grid grid-cols-1 gap-2">
                {triviaPair[triviaIdx].opts.map((opt, idx) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      if (idx !== triviaPair[triviaIdx].ans) {
                        finish(false, `Incorrect! Answer was "${triviaPair[triviaIdx].opts[triviaPair[triviaIdx].ans]}".`);
                      } else if (triviaIdx >= 1) {
                        finish(true, 'Perfect 2/2 Trivia Champion!');
                      } else {
                        setTriviaIdx(1);
                      }
                    }}
                    className="px-4 py-2.5 bg-[#1a2533] hover:bg-purple-600 text-left text-xs font-semibold text-white rounded-xl border border-white/10 cursor-pointer"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {game.engine === 'rps' && (
            <div className="max-w-sm mx-auto space-y-3 text-center">
              <div className="text-xs font-mono-nums text-slate-300">
                Best of 3 — You <strong className="text-emerald-400">{rpsScore.me}</strong> :{' '}
                <strong className="text-rose-400">{rpsScore.bot}</strong> Bot
              </div>
              <div className="grid grid-cols-3 gap-2">
                {rpsMoves.map((mv, idx) => (
                  <button
                    key={mv}
                    type="button"
                    onClick={() => {
                      const bot = Math.floor(Math.random() * 3);
                      if (idx === bot) {
                        setStatusMsg(`Draw! Both picked ${mv}. Pick again!`);
                        return;
                      }
                      const wonRound = (idx - bot + 3) % 3 === 1;
                      const next = {
                        me: rpsScore.me + (wonRound ? 1 : 0),
                        bot: rpsScore.bot + (wonRound ? 0 : 1),
                      };
                      setRpsScore(next);
                      setStatusMsg(`You: ${mv} vs Bot: ${rpsMoves[bot]} (${wonRound ? 'Win' : 'Loss'})`);
                      if (next.me >= 2) finish(true, `Defeated Arcade Bot ${next.me}-${next.bot}!`);
                      else if (next.bot >= 2) finish(false, `Bot won ${next.bot}-${next.me}.`);
                    }}
                    className="py-3 bg-[#1a2533] hover:bg-purple-600 text-white text-xs font-bold rounded-xl border border-white/10 cursor-pointer"
                  >
                    {mv}
                  </button>
                ))}
              </div>
            </div>
          )}

          {game.engine === 'guess' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = Number(guessInput);
                if (!Number.isFinite(val)) return;
                setGuessInput('');
                if (val === secretNum) {
                  finish(true, `Cracked secret code ${secretNum}!`);
                } else {
                  const left = guessTries - 1;
                  setGuessTries(left);
                  if (left <= 0) finish(false, `Out of tries! Code was ${secretNum}.`);
                  else setGuessHint(val < secretNum ? `Higher than ${val}! (${left} tries left)` : `Lower than ${val}! (${left} tries left)`);
                }
              }}
              className="max-w-xs mx-auto space-y-3 text-center"
            >
              <div className="text-xs text-amber-300 font-semibold">{guessHint}</div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  placeholder="1 - 20"
                  className="flex-1 px-3 py-2 bg-[#0a1015] border border-white/15 rounded-xl text-sm text-white text-center outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Guess
                </button>
              </div>
            </form>
          )}

          {game.engine === 'word' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (wordGuess.trim().toUpperCase() === wordPick.word) {
                  finish(true, `Correct! The word was ${wordPick.word}!`);
                } else {
                  finish(false, `Not quite! The word was ${wordPick.word}.`);
                }
              }}
              className="max-w-sm mx-auto space-y-3 text-center"
            >
              <div className="font-mono text-2xl tracking-[0.35em] font-extrabold text-amber-300 py-2">
                {wordPick.scrambled}
              </div>
              <div className="text-[11px] text-slate-400">Hint: {wordPick.hint}</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={wordGuess}
                  onChange={(e) => setWordGuess(e.target.value)}
                  placeholder="Type unscrambled word..."
                  className="flex-1 px-3 py-2 bg-[#0a1015] border border-white/15 rounded-xl text-xs text-white uppercase text-center outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Submit
                </button>
              </div>
            </form>
          )}

          {game.engine === 'dice' && (
            <div className="max-w-sm mx-auto space-y-3 text-center">
              {diceRoll && (
                <div className="text-2xl font-mono-nums font-extrabold text-amber-300">
                  🎲 {diceRoll[0]} + 🎲 {diceRoll[1]} = {diceRoll[0] + diceRoll[1]}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['low', 'Low (2–6)'],
                    ['seven', 'Lucky 7'],
                    ['high', 'High (8–12)'],
                  ] as const
                ).map(([pick, label]) => (
                  <button
                    key={pick}
                    type="button"
                    onClick={() => {
                      const d1 = 1 + Math.floor(Math.random() * 6);
                      const d2 = 1 + Math.floor(Math.random() * 6);
                      const sum = d1 + d2;
                      setDiceRoll([d1, d2]);
                      const won =
                        (pick === 'low' && sum <= 6) ||
                        (pick === 'seven' && sum === 7) ||
                        (pick === 'high' && sum >= 8);
                      finish(won, `Rolled ${d1} + ${d2} = ${sum}!`);
                    }}
                    className="py-3 bg-[#1a2533] hover:bg-amber-600 text-white text-xs font-bold rounded-xl border border-white/10 cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
