import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Instagram,
  KeyRound,
  LogIn,
  Mail,
  SearchCheck,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import {
  checkVerifiedFollowerInFirestore,
  sanitizeInstagramId,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../lib/firebase.ts';
import { SHOWCASE_ADS } from '../shared/worldData.ts';
import { useGameStore } from '../store/gameStore.ts';

const HERO_IMAGE = '/src/assets/images/green_valley_hero_1795609556675.jpg';
const IG_EMAIL_MAP_KEY = 'typixel_ig_email_map_v1';

type AuthTab = 'signin' | 'signup' | 'forgot';

interface FollowVerificationResult {
  instagramId: string;
  followsOfficial: boolean;
  followsStudio: boolean;
  verified: boolean;
  checkedAt: number;
}

function rememberIgEmail(igUsername: string, gmail: string): void {
  const cleanIg = sanitizeInstagramId(igUsername).toLowerCase();
  const cleanEmail = gmail.trim().toLowerCase();
  if (!cleanIg || !cleanEmail) return;
  try {
    const raw = localStorage.getItem(IG_EMAIL_MAP_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[cleanIg] = cleanEmail;
    localStorage.setItem(IG_EMAIL_MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function lookupEmailByIg(igOrEmail: string): string {
  const val = igOrEmail.trim();
  if (val.includes('@') && val.indexOf('@') > 0) return val;
  const cleanIg = sanitizeInstagramId(val).toLowerCase();
  try {
    const raw = localStorage.getItem(IG_EMAIL_MAP_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return map[cleanIg] || '';
  } catch {
    return '';
  }
}

export function LoginScreen() {
  const setPendingInstagramDraft = useGameStore((s) => s.setPendingInstagramDraft);

  const [tab, setTab] = useState<AuthTab>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(true);
  const [adIndex, setAdIndex] = useState(0);

  // Real Server + Firestore Follower Verification State (NO click-to-unlock!)
  const [verifyIgInput, setVerifyIgInput] = useState('');
  const [verifyingFollow, setVerifyingFollow] = useState(false);
  const [verifyResult, setVerifyResult] = useState<FollowVerificationResult | null>(null);
  const [requestingReview, setRequestingReview] = useState(false);
  const [reviewRequestedFor, setReviewRequestedFor] = useState<string | null>(null);

  const cleanInputIg = sanitizeInstagramId(verifyIgInput).toLowerCase();
  const isCurrentIdVerified = Boolean(
    verifyResult &&
      verifyResult.verified &&
      verifyResult.instagramId === cleanInputIg &&
      cleanInputIg.length >= 2,
  );

  // Auth Form Fields
  const [igOrEmail, setIgOrEmail] = useState('');
  const [gmail, setGmail] = useState('');
  const [instagramId, setInstagramId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAdIndex((prev) => (prev + 1) % SHOWCASE_ADS.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, []);

  const handleVerifyFollowers = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfoMsg(null);
    const cleanIg = sanitizeInstagramId(verifyIgInput).toLowerCase();
    if (cleanIg.length < 2) {
      setError('Enter your Instagram username (2–30 characters) to verify your follow status.');
      return;
    }

    setVerifyingFollow(true);
    try {
      const [apiResp, firestoreRec] = await Promise.all([
        fetch('/api/instagram/verify-follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instagramId: cleanIg }),
        })
          .then(async (r) => (r.ok ? ((await r.json()) as Partial<FollowVerificationResult>) : null))
          .catch(() => null),
        checkVerifiedFollowerInFirestore(cleanIg),
      ]);

      const followsOfficial = Boolean(
        apiResp?.followsOfficial || firestoreRec?.followsOfficial,
      );
      const followsStudio = Boolean(apiResp?.followsStudio || firestoreRec?.followsStudio);
      const verified = followsOfficial && followsStudio;

      setVerifyResult({
        instagramId: cleanIg,
        followsOfficial,
        followsStudio,
        verified,
        checkedAt: Date.now(),
      });

      if (verified) {
        setInstagramId(cleanIg);
        setPendingInstagramDraft(cleanIg);
        setInfoMsg(
          `Verified! @${cleanIg} follows both @typixelofficial and @typixel.studio. Login is now unlocked.`,
        );
      } else {
        const missing: string[] = [];
        if (!followsOfficial) missing.push('@typixelofficial');
        if (!followsStudio) missing.push('@typixel.studio');
        setError(
          `@${cleanIg} was NOT found in the followers of ${missing.join(' and ')}. Follow both pages on Instagram, then request verification or retry after follower sync.`,
        );
      }
    } catch {
      setError('Could not complete follower check right now. Please try again.');
    } finally {
      setVerifyingFollow(false);
    }
  };

  const handleRequestVerification = async () => {
    const cleanIg = sanitizeInstagramId(verifyIgInput).toLowerCase();
    if (cleanIg.length < 2) return;
    setRequestingReview(true);
    setError(null);
    try {
      const resp = await fetch('/api/instagram/request-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagramId: cleanIg }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        setError(data.error || 'Could not submit verification request.');
        return;
      }
      setReviewRequestedFor(cleanIg);
      setInfoMsg(
        `Verification request sent for @${cleanIg}! Once the admin verifies your follow on @typixelofficial and @typixel.studio, click "Check Followers" again.`,
      );
    } catch {
      setError('Could not submit verification request right now.');
    } finally {
      setRequestingReview(false);
    }
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
      return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method → Email/Password). Use "Continue with Gmail (Google)" right away!';
    }
    if (code === 'auth/email-already-in-use') {
      return 'This Gmail is already registered. Switch to Sign In instead.';
    }
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      return 'Incorrect credentials. Check your Gmail / Instagram username and game password, or use Forgot Password.';
    }
    if (code === 'auth/weak-password') {
      return 'Game password must be at least 6 characters.';
    }
    return err instanceof Error ? err.message : 'Unable to complete sign-in.';
  };

  const ensureFollowVerified = (): boolean => {
    if (!isCurrentIdVerified) {
      setError(
        'Enter your Instagram username in Step 1 and click "Check Followers" to confirm you follow both @typixelofficial and @typixel.studio.',
      );
      return false;
    }
    return true;
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfoMsg(null);
    if (!ensureFollowVerified()) return;
    setLoading(true);
    try {
      if (cleanInputIg) setPendingInstagramDraft(cleanInputIg);
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
    if (!ensureFollowVerified()) return;
    const resolvedEmail = lookupEmailByIg(igOrEmail);
    if (!resolvedEmail) {
      setError(
        'Enter your Gmail address (or an Instagram username previously signed up on this device).',
      );
      return;
    }
    if (password.length < 6) {
      setError('Enter your game password (minimum 6 characters).');
      return;
    }
    setLoading(true);
    try {
      setPendingInstagramDraft(cleanInputIg);
      await signInWithEmail(resolvedEmail, password);
    } catch (err: unknown) {
      setError(formatFirebaseError(err));
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    if (!ensureFollowVerified()) return;
    const cleanIg = cleanInputIg || sanitizeInstagramId(instagramId).toLowerCase();
    if (cleanIg.length < 2) {
      setError('A verified Instagram username is required to create a Green Valley account.');
      return;
    }
    if (!gmail.trim().includes('@')) {
      setError('Enter your Gmail address for account security & password recovery.');
      return;
    }
    if (password.length < 6) {
      setError('Create a game password of at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const finalName = displayName.trim().length >= 2 ? displayName.trim() : cleanIg;
      rememberIgEmail(cleanIg, gmail);
      setPendingInstagramDraft(cleanIg);
      await signUpWithEmail(gmail, password, finalName);
    } catch (err: unknown) {
      setError(formatFirebaseError(err));
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    const targetEmail = lookupEmailByIg(gmail || igOrEmail);
    if (!targetEmail || !targetEmail.includes('@')) {
      setError('Enter your registered Gmail address to receive a password reset link.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(targetEmail);
      setInfoMsg(
        `Password reset link sent to ${targetEmail}! Check your Gmail inbox or spam folder.`,
      );
    } catch (err: unknown) {
      setError(formatFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const featuredAd = SHOWCASE_ADS[adIndex];
  const checkedCurrent = Boolean(verifyResult && verifyResult.instagramId === cleanInputIg);

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
            className="w-full h-full object-cover object-center opacity-80"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#080d11]/95 via-[#080d11]/75 to-[#080d11]/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080d11]/95 via-transparent to-[#080d11]/60" />
      </div>

      {/* Top Navigation */}
      <header className="relative z-10 w-full max-w-[1440px] mx-auto px-6 md:px-10 py-4 flex items-center justify-between gap-6 shrink-0">
        <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          TYPIXEL OPEN WORLD
        </span>

        <div className="hidden lg:flex items-center gap-5 text-xs text-slate-300">
          <span>Active Hospital &amp; Buildings</span>
          <span className="text-slate-600">·</span>
          <span>KSRTC Bus &amp; Tea Stalls</span>
          <span className="text-slate-600">·</span>
          <span>Single-to-Mingle &amp; Weddings</span>
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
              Green Valley · 3D Open World Life Sim
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.06] [text-wrap:balance]">
              Live, Drive KSRTC, Start a Tea Stall &amp; Mingle in Green Valley
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed max-w-lg">
              Enter active hospitals, malls &amp; colleges, open your own 3D Chaya Kada, claim 7-day
              Daily Login Rewards, join hourly Single-to-Mingle weddings &amp; lakeside honeymoons,
              and arrive straight at your Instagram-linked home!
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

          {/* Right Auth Card with REAL Follower Verification Gate */}
          <div className="lg:col-span-6 flex lg:justify-end">
            <div className="w-full max-w-[450px] bg-[#0e151b]/95 border border-white/14 rounded-xl overflow-hidden">
              {/* Step 1: Real Instagram Follower Verification */}
              <div className="p-4 bg-[#0a1117] border-b border-white/10 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Instagram className="w-4 h-4 text-pink-400" />
                    Step 1: Verify You Follow Both Pages
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      isCurrentIdVerified ? 'text-emerald-400' : 'text-amber-300'
                    }`}
                  >
                    {isCurrentIdVerified ? 'Verified ✓' : 'Locked'}
                  </span>
                </div>

                {/* Follow Links (Opening links does NOT auto-unlock!) */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="https://www.instagram.com/typixelofficial/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                      checkedCurrent && verifyResult?.followsOfficial
                        ? 'bg-emerald-950/50 border-emerald-500/45 text-emerald-200'
                        : checkedCurrent
                          ? 'bg-rose-950/40 border-rose-500/40 text-rose-200 hover:bg-rose-900/40'
                          : 'bg-pink-950/30 border-pink-500/35 text-pink-100 hover:bg-pink-900/40'
                    }`}
                  >
                    <span className="truncate">@typixelofficial</span>
                    {checkedCurrent ? (
                      verifyResult?.followsOfficial ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )
                    ) : (
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </a>

                  <a
                    href="https://www.instagram.com/typixel.studio/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                      checkedCurrent && verifyResult?.followsStudio
                        ? 'bg-emerald-950/50 border-emerald-500/45 text-emerald-200'
                        : checkedCurrent
                          ? 'bg-rose-950/40 border-rose-500/40 text-rose-200 hover:bg-rose-900/40'
                          : 'bg-pink-950/30 border-pink-500/35 text-pink-100 hover:bg-pink-900/40'
                    }`}
                  >
                    <span className="truncate">@typixel.studio</span>
                    {checkedCurrent ? (
                      verifyResult?.followsStudio ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )
                    ) : (
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </a>
                </div>

                {/* Real ID Check Form */}
                <form onSubmit={handleVerifyFollowers} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400 text-xs font-bold">
                      @
                    </span>
                    <input
                      type="text"
                      maxLength={30}
                      value={verifyIgInput}
                      onChange={(e) => {
                        setVerifyIgInput(e.target.value.replace(/^@+/, ''));
                        setError(null);
                      }}
                      placeholder="your_instagram_id"
                      className="w-full pl-7 pr-3 py-2 bg-[#0e151b] border border-white/15 focus:border-pink-400 rounded-lg text-xs text-white placeholder-slate-500 outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={verifyingFollow || cleanInputIg.length < 2}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <SearchCheck className="w-3.5 h-3.5" />
                    <span>{verifyingFollow ? 'Checking...' : 'Check Followers'}</span>
                  </button>
                </form>

                {/* If checked and not found yet, allow requesting admin follower verification */}
                {checkedCurrent && !verifyResult?.verified && (
                  <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      Just followed both pages?
                    </span>
                    <button
                      type="button"
                      disabled={requestingReview || reviewRequestedFor === cleanInputIg}
                      onClick={() => void handleRequestVerification()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600/25 hover:bg-amber-600/40 border border-amber-400/40 disabled:opacity-60 text-amber-200 font-semibold rounded-md cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      {reviewRequestedFor === cleanInputIg
                        ? 'Request Sent ✓'
                        : requestingReview
                          ? 'Sending...'
                          : 'Request Verification'}
                    </button>
                  </div>
                )}
              </div>

              {/* Tabs: Sign In / Sign Up / Reset */}
              <div className="grid grid-cols-3 border-b border-white/10 bg-[#0a1015]">
                {(
                  [
                    ['signin', 'Sign In'],
                    ['signup', 'Insta Sign Up'],
                    ['forgot', 'Forgot Pass'],
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
                        ? 'text-white bg-[#0e151b] border-b-2 border-emerald-500'
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
                      disabled={loading || !isCurrentIdVerified}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                    >
                      <LogIn className="w-4 h-4 shrink-0" />
                      <span>
                        {loading
                          ? 'Signing in...'
                          : isCurrentIdVerified
                            ? 'Continue with Gmail (Google)'
                            : 'Verify Followers First to Sign In'}
                      </span>
                    </button>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <div className="flex-1 h-px bg-white/10" />
                      <span>or Instagram username / Gmail</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <form onSubmit={handleSignIn} className="space-y-2.5">
                      <input
                        type="text"
                        required
                        value={igOrEmail}
                        onChange={(e) => setIgOrEmail(e.target.value)}
                        placeholder="@instagram_username or your@gmail.com"
                        className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                      />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Game Password"
                        className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                      />
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Matches your home automatically</span>
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
                        disabled={loading || !isCurrentIdVerified}
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
                          readOnly={isCurrentIdVerified}
                          maxLength={30}
                          value={isCurrentIdVerified ? cleanInputIg : instagramId}
                          onChange={(e) => setInstagramId(e.target.value.replace(/^@+/, ''))}
                          placeholder="verified_insta_id"
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
                      required
                      value={gmail}
                      onChange={(e) => setGmail(e.target.value)}
                      placeholder="Your Gmail (for verification & reset link)"
                      className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                    />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create Green Valley Password (min 6 chars)"
                      className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                    />
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Use a new Green Valley password (never enter your real Instagram password).
                    </p>
                    <button
                      type="submit"
                      disabled={loading || !isCurrentIdVerified}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>
                        {loading
                          ? 'Creating Account...'
                          : isCurrentIdVerified
                            ? 'Sign Up with Verified Instagram ID'
                            : 'Verify Followers First'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading || !isCurrentIdVerified}
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
                      Enter your registered Gmail address and we will email a secure password reset
                      link immediately.
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

                <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-0.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Login checks your real Instagram ID against the followers of @typixelofficial &amp;
                    @typixel.studio.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-[1440px] mx-auto px-6 md:px-10 py-3.5 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 shrink-0">
        <span>TYPIXEL OPEN WORLD · @typixelofficial &amp; @typixel.studio</span>
        <span>WASD Move · E Enter/Interact · M Zoom Map · T Chat · V Voice</span>
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
            <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed list-disc pl-5">
              <li>
                Follow both <strong>@typixelofficial</strong> and <strong>@typixel.studio</strong> on
                Instagram, enter your exact Instagram username in Step 1, and click{' '}
                <strong>Check Followers</strong>.
              </li>
              <li>
                Owners can sync live follower lists anytime inside{' '}
                <strong>Admin Studio → Followers</strong> (using Instagram&apos;s official{' '}
                <code>followers_1.json</code> export or a live Instagram Data API key).
              </li>
              <li>
                Claim your <strong>Daily Login Reward</strong> every day for escalating Green Coins.
              </li>
              <li>
                Walk up to any building portal (Hospital, Mall, KSRTC Terminal, School, Wedding
                Mandapam) and press <strong>E</strong> to enter and use services!
              </li>
              <li>
                Open your own <strong>Kerala Tea Stall (Chaya Kada)</strong> or shop from the{' '}
                <strong>Shops</strong> menu and earn coins from customers!
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
