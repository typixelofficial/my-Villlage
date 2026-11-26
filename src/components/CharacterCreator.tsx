import { useState } from 'react';
import { ArrowRight, Heart, LogOut, RotateCcw, Sparkles } from 'lucide-react';
import type {
  AccessoryType,
  AnimationState,
  CharacterAppearance,
  Gender,
  HairStyle,
  RelationshipStatus,
  ShirtStyle,
} from '../shared/types.ts';
import { DEFAULT_APPEARANCE, DEFAULT_FEMALE_APPEARANCE } from '../shared/types.ts';
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
import { PlayerAvatarDP } from './PlayerAvatarDP.tsx';

const SKIN_TONES = [
  { label: 'Porcelain', hex: '#f5d6c3' },
  { label: 'Warm Fair', hex: '#e8be9e' },
  { label: 'Honey', hex: '#d49d73' },
  { label: 'Caramel', hex: '#b5784c' },
  { label: 'Chestnut', hex: '#8c5332' },
  { label: 'Espresso', hex: '#5b3420' },
];

const HAIR_COLORS = ['#1c1917', '#4a3123', '#8c5828', '#d9a441', '#a63a2b', '#475569', '#e2e8f0'];
const SHIRT_COLORS = [
  '#e11d48',
  '#1f7a5c',
  '#2563eb',
  '#d97706',
  '#7c3aed',
  '#ec4899',
  '#0f766e',
  '#1e293b',
  '#f8fafc',
];
const PANTS_COLORS = ['#283344', '#1e293b', '#fda4af', '#7c3aed', '#d97706', '#14532d'];
const SHOE_COLORS = ['#e5e7eb', '#18181b', '#ef4444', '#0ea5e9', '#d97706'];

const MALE_HAIRS: { id: HairStyle; label: string }[] = [
  { id: 'short', label: 'Short' },
  { id: 'fade', label: 'Fade' },
  { id: 'spiky', label: 'Spiky' },
  { id: 'curly', label: 'Curly' },
];

const FEMALE_HAIRS: { id: HairStyle; label: string }[] = [
  { id: 'long', label: 'Long Waves' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'braids', label: 'Twin Braids' },
  { id: 'bob', label: 'Classic Bob' },
];

const MALE_OUTFITS: { id: ShirtStyle; label: string }[] = [
  { id: 'jacket', label: 'Jacket' },
  { id: 'mundu', label: 'Kerala Mundu' },
  { id: 'shirt', label: 'Formal Shirt' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'polo', label: 'Polo' },
  { id: 'tee', label: 'T-Shirt' },
];

const FEMALE_OUTFITS: { id: ShirtStyle; label: string }[] = [
  { id: 'dress', label: 'Flared Dress' },
  { id: 'kurti', label: 'Kurti & Dupatta' },
  { id: 'lehenga', label: 'Royal Lehenga' },
  { id: 'jacket', label: 'Chic Jacket' },
  { id: 'hoodie', label: 'Cozy Hoodie' },
  { id: 'tee', label: 'Casual Top' },
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
  const [age, setAge] = useState<number>(existingProfile?.age ?? 22);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus>(
    existingProfile?.relationshipStatus ?? 'single',
  );
  const [appearance, setAppearance] = useState<CharacterAppearance>(
    existingProfile?.appearance || { ...DEFAULT_APPEARANCE },
  );
  const [previewAnim, setPreviewAnim] = useState<AnimationState>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFemale = appearance.gender === 'female';
  const activeHairs = isFemale ? FEMALE_HAIRS : MALE_HAIRS;
  const activeOutfits = isFemale ? FEMALE_OUTFITS : MALE_OUTFITS;

  const updateField = <K extends keyof CharacterAppearance>(
    key: K,
    val: CharacterAppearance[K],
  ) => {
    setAppearance((prev) => ({ ...prev, [key]: val }));
  };

  const handleGenderSwitch = (nextGender: Gender) => {
    if (nextGender === appearance.gender) return;
    if (nextGender === 'female') {
      setAppearance((prev) => ({
        ...DEFAULT_FEMALE_APPEARANCE,
        skinTone: prev.skinTone,
        hairColor: prev.hairColor,
      }));
    } else {
      setAppearance((prev) => ({
        ...DEFAULT_APPEARANCE,
        skinTone: prev.skinTone,
        hairColor: prev.hairColor,
      }));
    }
  };

  const handleRandomize = () => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const g = pick<Gender>(['male', 'female']);
    setAppearance({
      gender: g,
      skinTone: pick(SKIN_TONES).hex,
      hairStyle: pick(g === 'female' ? FEMALE_HAIRS : MALE_HAIRS).id,
      hairColor: pick(HAIR_COLORS),
      shirtStyle: pick(g === 'female' ? FEMALE_OUTFITS : MALE_OUTFITS).id,
      shirtColor: pick(SHIRT_COLORS),
      pantsColor: pick(PANTS_COLORS),
      shoeColor: pick(SHOE_COLORS),
      accessory: pick(ACCESSORIES).id,
    });
  };

  const handleSaveAndEnter = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!firebaseUser || saving) return;
    const cleaned = displayName.replace(/[^a-zA-Z0-9 _\-]/g, '').trim();
    if (cleaned.length < 2 || cleaned.length > 24) {
      setError('Display name must be 2–24 characters using letters, numbers, spaces, or hyphens.');
      return;
    }
    const safeAge = Math.max(18, Math.min(90, Math.round(Number(age) || 22)));
    const cleanedInsta = sanitizeInstagramId(instagramId);

    setError(null);
    setSaving(true);
    try {
      if (existingProfile) {
        await savePlayerAppearance(
          firebaseUser.uid,
          cleaned,
          cleanedInsta,
          firebaseUser.photoURL || existingProfile.photoURL || '',
          appearance,
          { age: safeAge, relationshipStatus },
        );
        const updated = {
          ...existingProfile,
          displayName: cleaned,
          instagramId: cleanedInsta,
          age: safeAge,
          relationshipStatus,
          photoURL: firebaseUser.photoURL || existingProfile.photoURL,
          appearance,
        };
        setProfile(updated);
        multiplayer.sendAppearance(cleaned, cleanedInsta, appearance, safeAge, relationshipStatus);
      } else {
        const created = await createPlayerProfile(
          firebaseUser,
          cleaned,
          cleanedInsta,
          appearance,
          {
            age: safeAge,
            relationshipStatus,
            followedOfficial: true,
            followedStudio: true,
          },
        );
        setProfile(created);
      }
      setScreen('world');
    } catch (err) {
      let friendly = 'Could not save your character right now. Please try entering again.';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message) as { error?: string };
          if (parsed?.error) {
            friendly = `${parsed.error} Please refresh or try entering again.`;
          } else {
            friendly = err.message;
          }
        } catch {
          friendly = err.message;
        }
      }
      setError(friendly);
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
      <header className="px-6 py-3.5 border-b border-white/10 bg-[#0e151b] flex items-center justify-between gap-6 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            TYPIXEL OPEN WORLD
          </span>
          <span aria-hidden="true" className="text-slate-600 hidden sm:inline">·</span>
          <span className="text-sm text-slate-400 truncate hidden sm:inline">
            Character Creation & Profile Studio
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
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
        <div className="lg:col-span-7 relative bg-[#111920] min-h-[280px] lg:min-h-0 flex flex-col">
          <div className="flex-1 relative">
            <CharacterPreviewCanvas appearance={appearance} previewAnim={previewAnim} />
          </div>

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
            Drag to rotate 360° · {isFemale ? 'Female Dress Collection' : 'Male Outfit Collection'}
          </div>
        </div>

        {/* Right: Customization Form */}
        <form
          onSubmit={(e) => void handleSaveAndEnter(e)}
          className="lg:col-span-5 bg-[#0e151b] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col min-h-0"
        >
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatarDP
                  displayName={displayName || 'Explorer'}
                  photoURL={firebaseUser?.photoURL || existingProfile?.photoURL || ''}
                  appearance={appearance}
                  size="sm"
                  ringClassName="ring-2 ring-emerald-400/60"
                />
                <div className="min-w-0">
                  <h1 className="font-display text-lg font-bold text-white truncate">Customize Character</h1>
                  <p className="text-[11px] text-slate-400 truncate">Your live DP appears in Single-to-Mingle</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRandomize}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Randomize
              </button>
            </div>

            {/* Name & Instagram ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="player-display-name" className="block text-xs font-medium text-slate-300">
                  Display Name
                </label>
                <input
                  id="player-display-name"
                  type="text"
                  value={displayName}
                  maxLength={24}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white outline-none"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="player-instagram-id" className="block text-xs font-medium text-slate-300">
                  Instagram ID <span className="text-emerald-400">(+200 GC)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
                  <input
                    id="player-instagram-id"
                    type="text"
                    value={instagramId}
                    maxLength={30}
                    onChange={(e) => setInstagramId(e.target.value.replace(/^@+/, ''))}
                    placeholder="your_insta_id"
                    className="w-full pl-7 pr-3 py-2 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Character Model (Boy vs Girl — Auto-loads matching outfits & silhouette) */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-300">Character Gender</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleGenderSwitch('male')}
                  className={`py-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    !isFemale
                      ? 'bg-sky-600/25 border-sky-400 text-sky-100'
                      : 'bg-[#0a1015] border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  Boy / Male Model
                </button>
                <button
                  type="button"
                  onClick={() => handleGenderSwitch('female')}
                  className={`py-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    isFemale
                      ? 'bg-pink-600/25 border-pink-400 text-pink-100'
                      : 'bg-[#0a1015] border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  Girl / Female Model
                </button>
              </div>
            </div>

            {/* Single or Mingle + Age (For Automatic Hourly Single-to-Mingle Matchmaking) */}
            <div className="p-3.5 bg-[#0a1015] border border-rose-500/25 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-200 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-400" />
                  Single-to-Mingle Profile
                </span>
                <span className="text-[11px] text-slate-400">Hourly Match & Wedding Event</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="player-age" className="block text-[11px] text-slate-400 mb-1">
                    Age (18–90)
                  </label>
                  <input
                    id="player-age"
                    type="number"
                    min={18}
                    max={90}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full px-2.5 py-2 bg-[#0e151b] border border-white/15 focus:border-rose-400 rounded-lg text-xs text-white outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <span className="block text-[11px] text-slate-400 mb-1">Status</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRelationshipStatus('single')}
                      className={`py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                        relationshipStatus === 'single'
                          ? 'bg-rose-600/25 border-rose-400 text-rose-100'
                          : 'bg-[#0e151b] border-white/10 text-slate-300'
                      }`}
                    >
                      Single (Auto-Match)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRelationshipStatus('mingle')}
                      className={`py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                        relationshipStatus !== 'single'
                          ? 'bg-emerald-600/25 border-emerald-400 text-emerald-100'
                          : 'bg-[#0e151b] border-white/10 text-slate-300'
                      }`}
                    >
                      Mingle / Taken
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Skin Tone */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-300">Skin Appearance</span>
              <div className="flex flex-wrap gap-2">
                {SKIN_TONES.map((tone) => (
                  <button
                    key={tone.hex}
                    type="button"
                    title={tone.label}
                    onClick={() => updateField('skinTone', tone.hex)}
                    style={{ backgroundColor: tone.hex }}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                      appearance.skinTone === tone.hex
                        ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0e151b] scale-110'
                        : 'border border-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Gender-Tailored Hairstyles */}
            <div className="space-y-2.5">
              <span className="block text-xs font-medium text-slate-300">
                {isFemale ? 'Female Hairstyle & Color' : 'Male Hairstyle & Color'}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {activeHairs.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => updateField('hairStyle', st.id)}
                    className={`py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                      appearance.hairStyle === st.id
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                        : 'bg-[#0a1015] border-white/10 text-slate-300'
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
                    onClick={() => updateField('hairColor', hex)}
                    style={{ backgroundColor: hex }}
                    className={`w-6 h-6 rounded-full cursor-pointer ${
                      appearance.hairColor === hex
                        ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0e151b]'
                        : 'border border-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Gender-Tailored Outfits & Dresses */}
            <div className="space-y-2.5">
              <span className="block text-xs font-medium text-slate-300">
                {isFemale ? 'Girl Dresses & Outfits' : 'Boy Outfits & Traditional Wear'}
              </span>
              <div className="grid grid-cols-3 gap-2">
                {activeOutfits.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => updateField('shirtStyle', st.id)}
                    className={`py-1.5 px-2 text-xs font-medium rounded-lg border cursor-pointer truncate ${
                      appearance.shirtStyle === st.id
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                        : 'bg-[#0a1015] border-white/10 text-slate-300'
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
                    onClick={() => updateField('shirtColor', hex)}
                    style={{ backgroundColor: hex }}
                    className={`w-6 h-6 rounded-full cursor-pointer ${
                      appearance.shirtColor === hex
                        ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0e151b]'
                        : 'border border-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Bottom / Skirt Color & Shoes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="block text-xs font-medium text-slate-300">
                  {isFemale ? 'Skirt / Leggings' : 'Trousers'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {PANTS_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => updateField('pantsColor', hex)}
                      style={{ backgroundColor: hex }}
                      className={`w-6 h-6 rounded-full cursor-pointer ${
                        appearance.pantsColor === hex
                          ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0e151b]'
                          : 'border border-white/20'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <span className="block text-xs font-medium text-slate-300">Footwear</span>
                <div className="flex flex-wrap gap-2">
                  {SHOE_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => updateField('shoeColor', hex)}
                      style={{ backgroundColor: hex }}
                      className={`w-6 h-6 rounded-full cursor-pointer ${
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
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                      appearance.accessory === acc.id
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                        : 'bg-[#0a1015] border-white/10 text-slate-300'
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
          <div className="p-4 border-t border-white/10 bg-[#0b1014] flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={() =>
                setAppearance(isFemale ? { ...DEFAULT_FEMALE_APPEARANCE } : { ...DEFAULT_APPEARANCE })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <span>
                {saving
                  ? 'Entering Green Valley...'
                  : existingProfile
                    ? 'Save & Return to Green Valley'
                    : 'Enter Green Valley'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
