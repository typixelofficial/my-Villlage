import { useState } from 'react';
import { ArrowRight, LogOut, RotateCcw, Sparkles } from 'lucide-react';
import type {
  AccessoryType,
  AnimationState,
  CharacterAppearance,
  Gender,
  HairStyle,
  ShirtStyle,
} from '../shared/types.ts';
import { DEFAULT_APPEARANCE } from '../shared/types.ts';
import { useGameStore } from '../store/gameStore.ts';
import {
  createPlayerProfile,
  sanitizeDisplayName,
  sanitizeInstagramId,
  savePlayerAppearance,
  signOutPlayer,
} from '../lib/firebase.ts';
import { multiplayer } from '../lib/multiplayer.ts';
import { CharacterPreviewCanvas } from './CharacterPreviewCanvas.tsx';

const SKIN_TONES = [
  { label: 'Porcelain', hex: '#f5d6c3' },
  { label: 'Warm Fair', hex: '#e8be9e' },
  { label: 'Honey', hex: '#d49d73' },
  { label: 'Caramel', hex: '#b5784c' },
  { label: 'Chestnut', hex: '#8c5332' },
  { label: 'Espresso', hex: '#5b3420' },
];

const HAIR_COLORS = ['#1c1917', '#4a3123', '#8c5828', '#d9a441', '#a63a2b', '#475569', '#e2e8f0'];
const SHIRT_COLORS = ['#1f7a5c', '#2563eb', '#dc2626', '#d97706', '#7c3aed', '#1e293b', '#f1f5f9'];
const PANTS_COLORS = ['#283344', '#1e293b', '#3f3f46', '#785c42', '#1d4ed8', '#14532d'];
const SHOE_COLORS = ['#e5e7eb', '#18181b', '#ef4444', '#0ea5e9', '#d97706'];

const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'short', label: 'Short' },
  { id: 'spiky', label: 'Spiky' },
  { id: 'bob', label: 'Bob' },
  { id: 'long', label: 'Long' },
  { id: 'ponytail', label: 'Ponytail' },
];

const SHIRT_STYLES: { id: ShirtStyle; label: string }[] = [
  { id: 'jacket', label: 'Jacket' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'tee', label: 'T-Shirt' },
  { id: 'polo', label: 'Polo' },
];

const ACCESSORIES: { id: AccessoryType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'cap', label: 'Cap' },
  { id: 'backpack', label: 'Backpack' },
  { id: 'headphones', label: 'Headphones' },
];

export function CharacterCreator() {
  const firebaseUser = useGameStore((s) => s.firebaseUser);
  const existingProfile = useGameStore((s) => s.profile);
  const isEditingExisting = useGameStore((s) => s.isEditingExistingCharacter);
  const pendingInstagramDraft = useGameStore((s) => s.pendingInstagramDraft);
  const setProfile = useGameStore((s) => s.setProfile);
  const setScreen = useGameStore((s) => s.setScreen);
  const resetForLogout = useGameStore((s) => s.resetForLogout);

  const [displayName, setDisplayName] = useState(
    existingProfile?.displayName ||
      sanitizeDisplayName(firebaseUser?.displayName || 'Valley Explorer'),
  );
  const [instagramId, setInstagramId] = useState(
    existingProfile?.instagramId || pendingInstagramDraft || '',
  );
  const [appearance, setAppearance] = useState<CharacterAppearance>(
    existingProfile?.appearance || { ...DEFAULT_APPEARANCE },
  );
  const [previewAnim, setPreviewAnim] = useState<AnimationState>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = <K extends keyof CharacterAppearance>(
    key: K,
    val: CharacterAppearance[K],
  ) => {
    setAppearance((prev) => ({ ...prev, [key]: val }));
  };

  const handleRandomize = () => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    setAppearance({
      gender: pick<Gender>(['male', 'female']),
      skinTone: pick(SKIN_TONES).hex,
      hairStyle: pick(HAIR_STYLES).id,
      hairColor: pick(HAIR_COLORS),
      shirtStyle: pick(SHIRT_STYLES).id,
      shirtColor: pick(SHIRT_COLORS),
      pantsColor: pick(PANTS_COLORS),
      shoeColor: pick(SHOE_COLORS),
      accessory: pick(ACCESSORIES).id,
    });
  };

  const handleSaveAndEnter = async () => {
    if (!firebaseUser) return;
    const cleaned = displayName.replace(/[^a-zA-Z0-9 _\-]/g, '').trim();
    if (cleaned.length < 2 || cleaned.length > 24) {
      setError('Display name must be 2–24 characters using letters, numbers, spaces, or hyphens.');
      return;
    }
    const cleanedInsta = sanitizeInstagramId(instagramId);

    setError(null);
    setSaving(true);
    try {
      if (existingProfile) {
        await savePlayerAppearance(
          firebaseUser.uid,
          cleaned,
          cleanedInsta,
          firebaseUser.photoURL || '',
          appearance,
        );
        const updated = {
          ...existingProfile,
          displayName: cleaned,
          instagramId: cleanedInsta,
          photoURL: firebaseUser.photoURL || existingProfile.photoURL,
          appearance,
        };
        setProfile(updated);
        multiplayer.sendAppearance(cleaned, cleanedInsta, appearance);
      } else {
        const created = await createPlayerProfile(
          firebaseUser,
          cleaned,
          cleanedInsta,
          appearance,
        );
        setProfile(created);
      }
      setScreen('world');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save character to Firestore.');
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    multiplayer.disconnect();
    await signOutPlayer();
    resetForLogout();
  };

  return (
    <div className="w-full h-screen bg-[#0b1014] text-[#f4f7f5] flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="px-6 py-4 border-b border-white/10 bg-[#0e151b] flex items-center justify-between gap-6 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            TYPIXEL OPEN WORLD
          </span>
          <span aria-hidden="true" className="text-slate-600 hidden sm:inline">·</span>
          <span className="text-sm text-slate-400 truncate hidden sm:inline">
            Character Creation Studio
          </span>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {firebaseUser && (
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              {firebaseUser.photoURL ? (
                <img
                  src={firebaseUser.photoURL}
                  alt={firebaseUser.displayName || 'Google Profile'}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover border border-white/15"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center font-semibold text-white">
                  {(firebaseUser.displayName || 'P')[0]}
                </div>
              )}
              <span className="hidden md:inline max-w-[160px] truncate">
                {firebaseUser.displayName || firebaseUser.email}
              </span>
            </div>
          )}

          {isEditingExisting ? (
            <button
              type="button"
              onClick={() => setScreen('world')}
              className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Back to World
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          )}
        </div>
      </header>

      {/* Main 2-Column Studio Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* Left: Live 3D Character Viewport */}
        <div className="lg:col-span-7 relative bg-[#111920] min-h-[300px] lg:min-h-0 flex flex-col">
          <div className="flex-1 relative">
            <CharacterPreviewCanvas appearance={appearance} previewAnim={previewAnim} />
          </div>

          {/* Bottom Preview Pose Controls */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0b1014]/90 border border-white/12 rounded-lg p-1.5">
            {(['idle', 'walk', 'run', 'wave', 'dance'] as AnimationState[]).map((pose) => (
              <button
                key={pose}
                type="button"
                onClick={() => setPreviewAnim(pose)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer whitespace-nowrap ${
                  previewAnim === pose
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {pose}
              </button>
            ))}
          </div>

          <div className="absolute top-4 left-5 text-xs text-slate-400 pointer-events-none">
            Drag to rotate 360°
          </div>
        </div>

        {/* Right: Customization Form */}
        <aside className="lg:col-span-5 bg-[#0e151b] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="font-display text-xl font-bold text-white">Customize Avatar</h1>
              <button
                type="button"
                onClick={handleRandomize}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Randomize
              </button>
            </div>

            {/* Display Name & Instagram ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="player-display-name" className="block text-xs font-medium text-slate-300">
                  Display Name
                </label>
                <input
                  id="player-display-name"
                  type="text"
                  value={displayName}
                  maxLength={24}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter player name"
                  className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="player-instagram-id" className="block text-xs font-medium text-slate-300">
                  Instagram ID <span className="text-emerald-400">(+200 GC Reward)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    @
                  </span>
                  <input
                    id="player-instagram-id"
                    type="text"
                    value={instagramId}
                    maxLength={30}
                    onChange={(e) => setInstagramId(e.target.value.replace(/^@+/, ''))}
                    placeholder="your_insta_id"
                    className="w-full pl-7 pr-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Model / Gender */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-300">Character Model</span>
              <div className="grid grid-cols-2 gap-2">
                {(['male', 'female'] as Gender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => updateField('gender', g)}
                    className={`py-2.5 text-xs font-semibold rounded-lg border capitalize transition-colors cursor-pointer ${
                      appearance.gender === g
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                        : 'bg-[#0a1015] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Skin Tone */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-300">Skin Appearance</span>
              <div className="flex flex-wrap gap-2.5">
                {SKIN_TONES.map((tone) => (
                  <button
                    key={tone.hex}
                    type="button"
                    title={tone.label}
                    aria-label={tone.label}
                    onClick={() => updateField('skinTone', tone.hex)}
                    style={{ backgroundColor: tone.hex }}
                    className={`w-8 h-8 rounded-full transition-transform cursor-pointer ${
                      appearance.skinTone === tone.hex
                        ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0e151b] scale-110'
                        : 'border border-white/20 hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Hairstyle & Color */}
            <div className="space-y-3">
              <span className="block text-xs font-medium text-slate-300">Hairstyle & Color</span>
              <div className="flex flex-wrap gap-2">
                {HAIR_STYLES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => updateField('hairStyle', st.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      appearance.hairStyle === st.id
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                        : 'bg-[#0a1015] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {HAIR_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Hair color ${hex}`}
                    onClick={() => updateField('hairColor', hex)}
                    style={{ backgroundColor: hex }}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                      appearance.hairColor === hex
                        ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0e151b]'
                        : 'border border-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Shirt Style & Color */}
            <div className="space-y-3">
              <span className="block text-xs font-medium text-slate-300">Top / Jacket</span>
              <div className="grid grid-cols-4 gap-2">
                {SHIRT_STYLES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => updateField('shirtStyle', st.id)}
                    className={`py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      appearance.shirtStyle === st.id
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                        : 'bg-[#0a1015] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {SHIRT_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Shirt color ${hex}`}
                    onClick={() => updateField('shirtColor', hex)}
                    style={{ backgroundColor: hex }}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                      appearance.shirtColor === hex
                        ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0e151b]'
                        : 'border border-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Trousers & Shoes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="block text-xs font-medium text-slate-300">Trousers</span>
                <div className="flex flex-wrap gap-2">
                  {PANTS_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Trousers color ${hex}`}
                      onClick={() => updateField('pantsColor', hex)}
                      style={{ backgroundColor: hex }}
                      className={`w-7 h-7 rounded-full cursor-pointer ${
                        appearance.pantsColor === hex
                          ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0e151b]'
                          : 'border border-white/20'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <span className="block text-xs font-medium text-slate-300">Shoes</span>
                <div className="flex flex-wrap gap-2">
                  {SHOE_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Shoe color ${hex}`}
                      onClick={() => updateField('shoeColor', hex)}
                      style={{ backgroundColor: hex }}
                      className={`w-7 h-7 rounded-full cursor-pointer ${
                        appearance.shoeColor === hex
                          ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0e151b]'
                          : 'border border-white/20'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Accessories */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-300">Accessories</span>
              <div className="flex flex-wrap gap-2">
                {ACCESSORIES.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => updateField('accessory', acc.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      appearance.accessory === acc.id
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                        : 'bg-[#0a1015] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="text-xs text-rose-200 bg-rose-950/70 border border-rose-500/35 rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}
          </div>

          {/* Sticky Footer Submit */}
          <div className="p-5 border-t border-white/10 bg-[#0b1014] flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setAppearance({ ...DEFAULT_APPEARANCE })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={handleSaveAndEnter}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>
                {saving
                  ? 'Saving Avatar...'
                  : existingProfile
                    ? 'Save & Return to Green Valley'
                    : 'Enter Green Valley'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
