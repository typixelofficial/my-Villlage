import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Instagram,
  KeyRound,
  LogIn,
  Mail,
  Shield,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  sanitizeInstagramId,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../lib/firebase.ts';
import { SHOWCASE_ADS } from '../shared/worldData.ts';
import { useGameStore } from '../store/gameStore.ts';

const HERO_IMAGE = '/src/assets/images/green_valley_hero_1795609556675.jpg';
const IG_EMAIL_MAP_KEY = 'typixel_ig_email_map_v2';

type AuthTab = 'signin' | 'signup' | 'forgot' | 'admin';

function rememberIgEmail(igUsername: string, email: string): void {
  const cleanIg = sanitizeInstagramId(igUsername).toLowerCase();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanIg || !cleanEmail) return;
  try {
    const raw = localStorage.getItem(IG_EMAIL_MAP_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[cleanIg] = cleanEmail;
    localStorage.setItem(IG_EMAIL_MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function resolveLoginEmail(rawInput: string): { email: string; cleanHandle: string } {
  const val = rawInput.trim();
  if (val.includes('@') && val.indexOf('@') > 0 && val.includes('.')) {
    return { email: val.toLowerCase(), cleanHandle: '' };
  }
  const cleanIg = sanitizeInstagramId(val).toLowerCase();
  if (!cleanIg) return { email: '', cleanHandle: '' };
  try {
    const raw = localStorage.getItem(IG_EMAIL_MAP_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    if (map[cleanIg]) return { email: map[cleanIg], cleanHandle: cleanIg };
  } catch {
    // ignore
  }
  return { email: `${cleanIg}@village.typixel.app`, cleanHandle: cleanIg };
}

export function LoginScreen() {
  const setPendingInstagramDraft = useGameStore((s) => s.setPendingInstagramDraft);
  const setAdminBearerToken = useGameStore((s) => s.setAdminBearerToken);
  const setIsAdmin = useGameStore((s) => s.setIsAdmin);

  const [tab, setTab] = useState<AuthTab>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(true);
  const [adIndex, setAdIndex] = useState(0);

  // Simple Direct Instagram Open + Return Monitor (never gets stuck on "Checking...")
  const [visitedOfficial, setVisitedOfficial] = useState(false);
  const [visitedStudio, setVisitedStudio] = useState(false);
  const [confirmedFollowed, setConfirmedFollowed] = useState(false);
  const pendingVisitRef = useRef<'official' | 'studio' | null>(null);

  const isUnlocked = (visitedOfficial && visitedStudio) || confirmedFollowed;

  // Citizen Auth Form Fields
  const [igOrEmail, setIgOrEmail] = useState('');
  const [gmail, setGmail] = useState('');
  const [instagramId, setInstagramId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  // Admin Login Form Fields
  const [adminConfigured, setAdminConfigured] = useState<boolean | null>(null);
  const [adminUsername, setAdminUsername] = useState('typixelofficial');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');

  // Rotating Typixel showcase ads
  useEffect(() => {
    const timer = window.setInterval(() => {
      setAdIndex((prev) => (prev + 1) % SHOWCASE_ADS.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, []);

  // Return-from-Instagram Monitor: detects focus/visibility return after visiting Instagram page
  useEffect(() => {
    const markReturned = () => {
      if (pendingVisitRef.current === 'official') {
        setVisitedOfficial(true);
        pendingVisitRef.current = null;
      } else if (pendingVisitRef.current === 'studio') {
        setVisitedStudio(true);
        pendingVisitRef.current = null;
      }
    };
    const onVisChange = () => {
      if (document.visibilityState === 'visible') markReturned();
    };
    window.addEventListener('focus', markReturned);
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      window.removeEventListener('focus', markReturned);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, []);

  // Load admin server configuration status when Admin tab opens
  useEffect(() => {
    if (tab !== 'admin' || adminConfigured !== null) return;
    fetch('/api/admin/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { configured?: boolean; expectedUsername?: string } | null) => {
        if (data) {
          setAdminConfigured(Boolean(data.configured));
          if (data.expectedUsername) setAdminUsername(data.expectedUsername);
        } else {
          setAdminConfigured(true);
        }
      })
      .catch(() => setAdminConfigured(true));
  }, [tab, adminConfigured]);

  const handleOpenInstagram = (which: 'official' | 'studio') => {
    pendingVisitRef.current = which;
    // Also mark visited immediately after short delay in case browser keeps focus in split/iframe mode
    window.setTimeout(() => {
      if (which === 'official') setVisitedOfficial(true);
      else setVisitedStudio(true);
    }, 1200);
  };

  const formatFirebaseError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/popup-closed-by-user') {
      return 'Google sign-in window was closed before finishing.';
    }
    if (code === 'auth/popup-blocked') {
      return 'Popup blocked by browser. Allow popups for this site and try again.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is not yet enabled in Firebase Console. Use "Continue with Gmail (Google)" instead!';
    }
    if (code === 'auth/email-already-in-use') {
      return 'This username or Gmail is already registered. Switch to Sign In instead.';
    }
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      return 'Incorrect username/Gmail or password. If this is your first time (e.g. __hashim_mhd_ or _rifadeeyy), switch to Sign Up to set your password!';
    }
    if (code === 'auth/weak-password') {
      return 'Password must be at least 6 characters.';
    }
    return err instanceof Error ? err.message : 'Unable to complete sign-in.';
  };

  const ensureFollowChecked = (): boolean => {
    if (!isUnlocked) {
      setError(
        'Tap both @typixelofficial and @typixel.studio above to open Instagram and follow, or check the follow confirmation box.',
      );
      return false;
    }
    return true;
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfoMsg(null);
    if (tab !== 'admin' && !ensureFollowChecked()) return;
    setLoading(true);
    try {
      const draft = sanitizeInstagramId(instagramId || igOrEmail);
      if (draft) setPendingInstagramDraft(draft);
      await signInWithGoogle();
    } catch (err: unknown) {
      setError(formatFirebaseError(err));
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    if (!ensureFollowChecked()) return;
    const { email, cleanHandle } = resolveLoginEmail(igOrEmail);
    if (!email) {
      setError('Enter your Instagram username (e.g. __hashim_mhd_ or _rifadeeyy) or Gmail.');
      return;
    }
    if (password.length < 6) {
      setError('Enter your password (minimum 6 characters).');
      return;
    }
    setLoading(true);
    try {
      if (cleanHandle) setPendingInstagramDraft(cleanHandle);
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      setError(formatFirebaseError(err));
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    if (!ensureFollowChecked()) return;
    const cleanIg = sanitizeInstagramId(instagramId).toLowerCase();
    if (cleanIg.length < 2) {
      setError('Enter your Instagram username (e.g. __hashim_mhd_ or _rifadeeyy).');
      return;
    }
    if (password.length < 6) {
      setError('Create a Green Valley password of at least 6 characters.');
      return;
    }
    const targetEmail =
      gmail.trim().includes('@') && gmail.trim().includes('.')
        ? gmail.trim().toLowerCase()
        : `${cleanIg}@village.typixel.app`;

    setLoading(true);
    try {
      const finalName = displayName.trim().length >= 2 ? displayName.trim() : cleanIg;
      rememberIgEmail(cleanIg, targetEmail);
      setPendingInstagramDraft(cleanIg);
      await signUpWithEmail(targetEmail, password, finalName);
    } catch (err: unknown) {
      setError(formatFirebaseError(err));
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    const { email } = resolveLoginEmail(gmail || igOrEmail);
    if (!email || !email.includes('@') || email.endsWith('@village.typixel.app')) {
      setError('Enter the real Gmail address linked to your account to receive a reset link.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setInfoMsg(`Password reset link sent to ${email}! Check your Gmail inbox or spam folder.`);
    } catch (err: unknown) {
      setError(formatFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    const cleanAdminUser = sanitizeInstagramId(adminUsername).toLowerCase() || 'typixelofficial';
    if (adminPassword.length < 6) {
      setError('Admin password must be at least 6 characters.');
      return;
    }
    if (adminConfigured === false && adminPassword !== adminConfirmPassword) {
      setError('Admin passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = adminConfigured === false ? '/api/admin/claim' : '/api/admin/login';
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanAdminUser, password: adminPassword }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        adminToken?: string;
        error?: string;
      };
      if (!resp.ok || !data.adminToken) {
        setError(data.error || 'Admin authentication failed.');
        setLoading(false);
        return;
      }

      // Store verified admin bearer token strictly in memory (Zustand, NEVER localStorage)
      setAdminBearerToken(data.adminToken);
      setIsAdmin(true);
      setPendingInstagramDraft(cleanAdminUser);

      // Sign in or auto-provision the paired Firebase session for real-time 3D world access
      const adminEmail = `${cleanAdminUser}@village.typixel.app`;
      try {
        await signInWithEmail(adminEmail, adminPassword);
      } catch (fbErr: unknown) {
        const fbCode = (fbErr as { code?: string })?.code || '';
        if (fbCode === 'auth/user-not-found' || fbCode === 'auth/invalid-credential') {
          try {
            await signUpWithEmail(adminEmail, adminPassword, 'Typixel Admin');
          } catch {
            // If Firebase Email/Password isn't enabled, prompt Google Sign-In while keeping Admin Token active
            setInfoMsg('Admin verified! Click "Owner Admin (Google)" below to enter 3D Green Valley.');
            setLoading(false);
          }
        } else {
          setInfoMsg('Admin verified! Click "Owner Admin (Google)" below to enter 3D Green Valley.');
          setLoading(false);
        }
      }
    } catch {
      setError('Could not reach Green Valley server for Admin Login.');
      setLoading(false);
    }
  };

  const featuredAd = SHOWCASE_ADS[adIndex];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0b1014] text-[#f4f7f5] flex flex-col justify-between">
      {/* Fast-loading Green Valley key art backdrop */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#0d1f1a] via-[#0b141a] to-[#0f172a]"
        aria-hidden="true"
      >
        {heroLoaded && (
          <img
            src={HERO_IMAGE}
            alt="Green Valley 3D Open World"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setHeroLoaded(false)}
            className="w-full h-full object-cover object-center opacity-75"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#080d11]/95 via-[#080d11]/75 to-[#080d11]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080d11]/95 via-transparent to-[#080d11]/60" />
      </div>

      {/* Top Navigation */}
      <header className="relative z-10 w-full max-w-[1440px] mx-auto px-6 md:px-10 py-4 flex items-center justify-between gap-6 shrink-0">
        <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          TYPIXEL OPEN WORLD
        </span>

        <div className="hidden lg:flex items-center gap-5 text-xs text-slate-300">
          <span>Hashim&apos;s &amp; Rifad&apos;s Villas</span>
          <span className="text-slate-600">·</span>
          <span>50+ Arcade Games &amp; Sports</span>
          <span className="text-slate-600">·</span>
          <span>Live Phone, Hospital &amp; KSRTC</span>
        </div>

        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white bg-[#101820]/85 hover:bg-[#17232e] border border-white/15 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <HelpCircle className="w-4 h-4 text-emerald-400" />
          Guide
        </button>
      </header>

      {/* Main Layout */}
      <main className="relative z-10 w-full max-w-[1440px] mx-auto px-6 md:px-10 flex-1 flex items-center overflow-y-auto py-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-center w-full">
          {/* Left Hero + Live @typixelofficial Showcase Ad Banner */}
          <div className="lg:col-span-6 space-y-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Green Valley · Expanded 3D Open World
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.06] [text-wrap:balance]">
              Build Your Home, Play 50+ Games &amp; Live in Green Valley
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed max-w-lg">
              Explore the expanded village, visit Hashim&apos;s &amp; Rifad&apos;s Palace Villas,
              play 3D football &amp; volleyball, hunt the hidden cliff VIP card for the Grand Game
              Center, call friends on your smartphone, and run your own Tea Stall.
            </p>

            {/* Live GitHub + Instagram Showcase Ad Card */}
            <a
              href={featuredAd.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block max-w-md bg-[#0e161d]/90 hover:bg-[#131e28] border border-white/15 rounded-xl overflow-hidden transition-colors"
            >
              <div className="flex items-center gap-3.5 p-2.5">
                <img
                  src={featuredAd.imageUrl}
                  alt={featuredAd.title}
                  loading="lazy"
                  className="w-20 h-20 rounded-lg object-cover bg-slate-900 shrink-0 border border-white/10"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                    <Instagram className="w-3 h-3" />
                    Typixel Showcase Ad
                  </div>
                  <p className="text-sm font-bold text-white truncate mt-0.5">{featuredAd.title}</p>
                  <p className="text-xs text-slate-400 truncate">{featuredAd.subtitle}</p>
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 group-hover:text-emerald-300 mt-1">
                    Visit Instagram <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </a>
          </div>

          {/* Right Auth Card with Simple Direct-Open Instagram Monitor + Admin Tab */}
          <div className="lg:col-span-6 flex lg:justify-end">
            <div className="w-full max-w-[460px] bg-[#0e151b]/95 border border-white/14 rounded-xl overflow-hidden">
              {/* Step 1: Simple Direct Instagram Open Monitor (hidden on Admin tab) */}
              {tab !== 'admin' && (
                <div className="p-4 bg-[#0a1117] border-b border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Instagram className="w-4 h-4 text-pink-400" />
                      Step 1: Follow Both Pages on Instagram
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${
                        isUnlocked ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {isUnlocked ? 'Ready ✓' : 'Tap Links'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href="https://www.instagram.com/typixelofficial/"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleOpenInstagram('official')}
                      className={`flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        visitedOfficial
                          ? 'bg-emerald-950/50 border-emerald-500/45 text-emerald-200'
                          : 'bg-pink-950/30 border-pink-500/35 text-pink-100 hover:bg-pink-900/40'
                      }`}
                    >
                      <span className="truncate">@typixelofficial</span>
                      {visitedOfficial ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </a>

                    <a
                      href="https://www.instagram.com/typixel.studio/"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleOpenInstagram('studio')}
                      className={`flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        visitedStudio
                          ? 'bg-emerald-950/50 border-emerald-500/45 text-emerald-200'
                          : 'bg-pink-950/30 border-pink-500/35 text-pink-100 hover:bg-pink-900/40'
                      }`}
                    >
                      <span className="truncate">@typixel.studio</span>
                      {visitedStudio ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </a>
                  </div>

                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none pt-0.5">
                    <input
                      type="checkbox"
                      checked={isUnlocked}
                      onChange={(e) => setConfirmedFollowed(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-emerald-500"
                    />
                    <span>I follow @typixelofficial and @typixel.studio on Instagram</span>
                  </label>
                </div>
              )}

              {/* Tabs: Sign In / Sign Up / Forgot / Admin */}
              <div className="grid grid-cols-4 border-b border-white/10 bg-[#0a1015]">
                {(
                  [
                    ['signin', 'Sign In'],
                    ['signup', 'Sign Up'],
                    ['forgot', 'Reset'],
                    ['admin', 'Admin'],
                  ] as [AuthTab, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setTab(id);
                      setError(null);
                      setInfoMsg(null);
                    }}
                    className={`py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                      tab === id
                        ? id === 'admin'
                          ? 'text-amber-300 bg-[#0e151b] border-b-2 border-amber-500'
                          : 'text-white bg-[#0e151b] border-b-2 border-emerald-500'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-5 space-y-3.5">
                {tab === 'signin' && (
                  <>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading || !isUnlocked}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                    >
                      <LogIn className="w-4 h-4 shrink-0" />
                      <span>{loading ? 'Signing in...' : 'Continue with Gmail (Google)'}</span>
                    </button>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <div className="flex-1 h-px bg-white/10" />
                      <span>or Instagram username &amp; password</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <form onSubmit={handleSignIn} className="space-y-2.5">
                      <input
                        type="text"
                        required
                        value={igOrEmail}
                        onChange={(e) => setIgOrEmail(e.target.value)}
                        placeholder="Username (e.g. __hashim_mhd_ / _rifadeeyy) or Gmail"
                        className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                      />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                      />
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Villa owners matched by username</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTab('forgot');
                            setError(null);
                          }}
                          className="text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <button
                        type="submit"
                        disabled={loading || !isUnlocked}
                        className="w-full py-2.5 bg-white/10 hover:bg-white/16 disabled:opacity-45 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                      >
                        {loading ? 'Signing in...' : 'Sign In'}
                      </button>
                    </form>
                  </>
                )}

                {tab === 'signup' && (
                  <form onSubmit={handleSignUp} className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400 text-xs font-bold">
                          @
                        </span>
                        <input
                          type="text"
                          required
                          maxLength={30}
                          value={instagramId}
                          onChange={(e) => setInstagramId(e.target.value.replace(/^@+/, ''))}
                          placeholder="__hashim_mhd_"
                          className="w-full pl-7 pr-3 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-xs text-white placeholder-slate-500 outline-none"
                        />
                      </div>
                      <input
                        type="text"
                        maxLength={24}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Display Name"
                        className="w-full px-3 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-xs text-white placeholder-slate-500 outline-none"
                      />
                    </div>
                    <input
                      type="email"
                      value={gmail}
                      onChange={(e) => setGmail(e.target.value)}
                      placeholder="Optional Gmail (for password reset link)"
                      className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                    />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Set Green Valley Password (min 6 chars)"
                      className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                    />
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Villa owners <strong>__hashim_mhd_</strong> and <strong>_rifadeeyy</strong>{' '}
                      set their password here on first sign-up.
                    </p>
                    <button
                      type="submit"
                      disabled={loading || !isUnlocked}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{loading ? 'Creating Account...' : 'Create Account & Enter'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading || !isUnlocked}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-white/10 hover:bg-white/15 disabled:opacity-45 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Or Sign Up Instantly with Gmail</span>
                    </button>
                  </form>
                )}

                {tab === 'forgot' && (
                  <form onSubmit={handleForgotPassword} className="space-y-3">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Enter your registered Gmail address to receive a secure password reset link.
                    </p>
                    <input
                      type="email"
                      required
                      value={gmail}
                      onChange={(e) => setGmail(e.target.value)}
                      placeholder="yourname@gmail.com"
                      className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>{loading ? 'Sending Reset Link...' : 'Send Reset Link to Gmail'}</span>
                    </button>
                  </form>
                )}

                {tab === 'admin' && (
                  <div className="space-y-3">
                    <div>
                      <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-amber-400" />
                        Green Valley Admin Access
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        Manage village size, custom homes, shop spaces, Palace Villas, and broadcast
                        Typixel updates to every citizen&apos;s phone.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Sign in as Owner Admin (Google)</span>
                    </button>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <div className="flex-1 h-px bg-white/10" />
                      <span>
                        {adminConfigured === false
                          ? 'first-run: set admin passcode'
                          : 'or admin username & password'}
                      </span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <form onSubmit={handleAdminSubmit} className="space-y-2.5">
                      <input
                        type="text"
                        required
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        placeholder="Admin username (typixelofficial)"
                        className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-amber-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                      />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder={
                          adminConfigured === false
                            ? 'Set server admin password (min 6 chars)'
                            : 'Admin password'
                        }
                        className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-amber-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                      />
                      {adminConfigured === false && (
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={adminConfirmPassword}
                          onChange={(e) => setAdminConfirmPassword(e.target.value)}
                          placeholder="Confirm admin password"
                          className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-amber-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                        />
                      )}
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/12 hover:bg-white/18 disabled:opacity-50 text-amber-200 font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>
                          {loading
                            ? 'Authenticating...'
                            : adminConfigured === false
                              ? 'Claim & Unlock Admin Studio'
                              : 'Sign In as Admin'}
                        </span>
                      </button>
                    </form>
                  </div>
                )}

                {infoMsg && (
                  <div className="text-xs text-emerald-200 bg-emerald-950/60 border border-emerald-500/35 rounded-lg px-3 py-2.5 leading-relaxed">
                    {infoMsg}
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="text-xs text-rose-200 bg-rose-950/70 border border-rose-500/35 rounded-lg px-3 py-2.5 leading-relaxed"
                  >
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-[1440px] mx-auto px-6 md:px-10 py-3.5 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 shrink-0">
        <span>TYPIXEL OPEN WORLD · @typixelofficial &amp; @typixel.studio</span>
        <span>WASD Move · E Interact · M Map · P Phone · K Kick Ball</span>
      </footer>

      {/* Quick Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111920] border border-white/15 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="font-display text-lg font-bold text-white">Green Valley Guide</h2>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc pl-5">
              <li>
                Tap <strong>@typixelofficial</strong> and <strong>@typixel.studio</strong> to open
                Instagram, follow both pages, and return — sign-in unlocks immediately.
              </li>
              <li>
                <strong>Hashim&apos;s Villa</strong> (<code>__hashim_mhd_</code>) and{' '}
                <strong>Rifad&apos;s Villa</strong> (<code>_rifadeeyy</code>) recognize their owners
                by username; visitors pay at the outer compound gate and enter inside only with the
                Secret Key.
              </li>
              <li>
                Collect the hidden <strong>VIP Game Center Entrance Card</strong> atop Danger Peak
                Cliff to unlock all 50+ cheap arcade games in the Grand Game Center.
              </li>
              <li>
                Keep an eye on your <strong>Health Bar</strong>: sprinting, falling from high cliffs,
                or rain drains HP — visit the Hospital or drink hot Chaya when below 50%!
              </li>
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
