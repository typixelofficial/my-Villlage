import { useEffect, useState } from 'react';
import {
  Compass,
  HelpCircle,
  KeyRound,
  LogIn,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  sanitizeInstagramId,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../lib/firebase.ts';
import { useGameStore } from '../store/gameStore.ts';

const HERO_IMAGE = '/src/assets/images/green_valley_hero_1795609556675.jpg';

type AuthTab = 'signin' | 'signup' | 'admin';

export function LoginScreen() {
  const setAdminSession = useGameStore((s) => s.setAdminSession);
  const adminToken = useGameStore((s) => s.adminToken);
  const setPendingInstagramDraft = useGameStore((s) => s.setPendingInstagramDraft);

  const [tab, setTab] = useState<AuthTab>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(true);

  // Email Sign-In / Sign-Up Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [instagramId, setInstagramId] = useState('');

  // Server Admin Passcode State
  const [adminStatus, setAdminStatus] = useState<{
    envConfigured: boolean;
    claimed: boolean;
    bootstrappedEmail: string;
  } | null>(null);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminPasscodeConfirm, setAdminPasscodeConfirm] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/admin/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setAdminStatus(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const formatFirebaseError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/popup-closed-by-user') {
      return 'Sign-in window was closed before completing Google authentication.';
    }
    if (code === 'auth/popup-blocked') {
      return 'Popup was blocked by your browser. Allow popups for this site and try again.';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'This domain is not authorized in Firebase Authentication settings.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method → Email/Password). You can use Google Sign-In right away.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Switch to Sign In instead.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Incorrect email or password. Double-check your credentials and try again.';
    }
    if (code === 'auth/weak-password') {
      return 'Password must be at least 6 characters long.';
    }
    return err instanceof Error ? err.message : 'Unable to complete authentication.';
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (instagramId.trim()) {
        setPendingInstagramDraft(sanitizeInstagramId(instagramId));
      }
      await signInWithGoogle();
    } catch (err: unknown) {
      setError(formatFirebaseError(err));
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!email.trim() || password.length < 6) {
      setError('Enter your email and password (at least 6 characters).');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      setError(formatFirebaseError(err));
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (displayName.trim().length < 2) {
      setError('Enter a player display name (at least 2 characters).');
      return;
    }
    if (!email.trim() || password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      setPendingInstagramDraft(sanitizeInstagramId(instagramId));
      await signUpWithEmail(email, password, displayName);
    } catch (err: unknown) {
      setError(formatFirebaseError(err));
      setLoading(false);
    }
  };

  const handleAdminPasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const isClaimFlow = adminStatus && !adminStatus.claimed;

    if (adminPasscode.trim().length < 6) {
      setError('Admin passcode must be at least 6 characters.');
      return;
    }
    if (isClaimFlow && adminPasscode !== adminPasscodeConfirm) {
      setError('Admin passcodes do not match.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isClaimFlow ? '/api/admin/claim' : '/api/admin/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: adminPasscode }),
      });
      const data = await res.json();
      if (!res.ok || !data.adminToken) {
        setError(data.error || 'Admin verification failed.');
        setLoading(false);
        return;
      }

      // Hold admin token ONLY in JavaScript memory (never localStorage)
      setAdminSession(true, String(data.adminToken));
      setAdminStatus((prev) => (prev ? { ...prev, claimed: true } : prev));
      setAdminPasscode('');
      setAdminPasscodeConfirm('');
      setNotice(
        'Admin session verified! Now sign in with Google or Email below to enter Green Valley with Admin Studio unlocked.',
      );
      setLoading(false);
    } catch {
      setError('Unable to reach server admin verification endpoint.');
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0b1014] text-[#f4f7f5] flex flex-col justify-between">
      {/* Full-bleed Green Valley key art backdrop */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#0d1f1a] via-[#0b141a] to-[#0f172a]"
        aria-hidden="true"
      >
        {heroLoaded && (
          <img
            src={HERO_IMAGE}
            alt="Green Valley stylized 3D lakeside open world"
            referrerPolicy="no-referrer"
            onError={() => setHeroLoaded(false)}
            className="w-full h-full object-cover object-center opacity-85"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#080d11]/95 via-[#080d11]/72 to-[#080d11]/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080d11]/92 via-transparent to-[#080d11]/55" />
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 w-full max-w-[1440px] mx-auto px-6 md:px-12 py-5 flex items-center justify-between gap-8 shrink-0">
        <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          TYPIXEL OPEN WORLD
        </span>

        <div className="hidden md:flex items-center gap-6 text-sm text-slate-300">
          <span className="whitespace-nowrap shrink-0">840m Open Valley</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="whitespace-nowrap shrink-0">Build Custom 3D Homes</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="whitespace-nowrap shrink-0">Works, Rewards & Walk-Up Vehicles</span>
        </div>

        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-200 hover:text-white bg-[#101820]/85 hover:bg-[#17232e] border border-white/15 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <HelpCircle className="w-4 h-4 text-emerald-400" />
          Setup Guide
        </button>
      </header>

      {/* Main Content Area: Left Title + Auth Card */}
      <main className="relative z-10 w-full max-w-[1440px] mx-auto px-6 md:px-12 flex-1 flex items-center overflow-y-auto py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
          {/* Left Hero Lockup */}
          <div className="lg:col-span-6 space-y-5">
            <p className="text-sm font-medium text-emerald-400 tracking-wide">
              Green Valley · Expansive 3D Multiplayer Life Simulation
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-white leading-[1.06] [text-wrap:balance]">
              Live, Work & Build in Green Valley
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg">
              Explore a vast 840m valley with long scenic highways and open Sunset Valley home
              plots. Earn Green Coins through works and rewards, build your own 3D home, walk up to
              rent or unlock vehicles, and connect with real players and their Instagram handles.
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-300 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                Live Socket.IO Multiplayer
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                Auto-Connected Firebase Backend
              </span>
            </div>
          </div>

          {/* Right Auth & Admin Card */}
          <div className="lg:col-span-6 flex lg:justify-end">
            <div className="w-full max-w-[440px] bg-[#0e151b]/95 border border-white/14 rounded-xl overflow-hidden">
              {/* 3-Tab Auth Selector */}
              <div className="grid grid-cols-3 border-b border-white/10 bg-[#0a1015]">
                <button
                  type="button"
                  onClick={() => {
                    setTab('signin');
                    setError(null);
                  }}
                  className={`py-3 text-xs font-semibold transition-colors cursor-pointer ${
                    tab === 'signin'
                      ? 'text-white bg-[#0e151b] border-b-2 border-emerald-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('signup');
                    setError(null);
                  }}
                  className={`py-3 text-xs font-semibold transition-colors cursor-pointer ${
                    tab === 'signup'
                      ? 'text-white bg-[#0e151b] border-b-2 border-emerald-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('admin');
                    setError(null);
                  }}
                  className={`py-3 text-xs font-semibold transition-colors cursor-pointer ${
                    tab === 'admin'
                      ? 'text-amber-300 bg-[#0e151b] border-b-2 border-amber-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Admin Login
                </button>
              </div>

              <div className="p-6 space-y-4">
                {adminToken && (
                  <div className="text-xs text-amber-200 bg-amber-950/60 border border-amber-500/35 rounded-lg px-3.5 py-2.5">
                    Admin Studio Pass Active — sign in below to launch Green Valley with Admin tools.
                  </div>
                )}

                {tab === 'signin' && (
                  <>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2.5 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                    >
                      <LogIn className="w-4 h-4 shrink-0" />
                      <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
                    </button>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <div className="flex-1 h-px bg-white/10" />
                      <span>or sign in with email</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <form onSubmit={handleEmailSignIn} className="space-y-3">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
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
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 bg-white/10 hover:bg-white/16 disabled:opacity-60 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                      >
                        {loading ? 'Signing in...' : 'Sign In with Email'}
                      </button>
                    </form>
                  </>
                )}

                {tab === 'signup' && (
                  <>
                    <form onSubmit={handleEmailSignUp} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          required
                          maxLength={24}
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Player name"
                          className="w-full px-3 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                        />
                        <input
                          type="text"
                          maxLength={31}
                          value={instagramId}
                          onChange={(e) => setInstagramId(e.target.value)}
                          placeholder="@instagram_id"
                          className="w-full px-3 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                        />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                      />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create password (min 6 chars)"
                        className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
                      </button>
                    </form>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <div className="flex-1 h-px bg-white/10" />
                      <span>or instant sign up</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/16 disabled:opacity-60 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign Up with Google</span>
                    </button>
                  </>
                )}

                {tab === 'admin' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h2 className="font-display text-sm font-bold text-white">
                        Green Valley Admin Access
                      </h2>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Admins can build custom 3D homes anywhere in Green Valley for any player,
                        manage residences, and reward active citizens.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Sign in as Owner Admin (Google)</span>
                    </button>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <div className="flex-1 h-px bg-white/10" />
                      <span>
                        {adminStatus && !adminStatus.claimed
                          ? 'first-run: claim server admin passcode'
                          : 'or unlock with admin passcode'}
                      </span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <form onSubmit={handleAdminPasscodeSubmit} className="space-y-2.5">
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={adminPasscode}
                        onChange={(e) => setAdminPasscode(e.target.value)}
                        placeholder={
                          adminStatus && !adminStatus.claimed
                            ? 'Set server admin passcode (min 6 chars)'
                            : 'Enter admin passcode'
                        }
                        className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-amber-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                      />
                      {adminStatus && !adminStatus.claimed && (
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={adminPasscodeConfirm}
                          onChange={(e) => setAdminPasscodeConfirm(e.target.value)}
                          placeholder="Confirm admin passcode"
                          className="w-full px-3.5 py-2.5 bg-[#0a1015] border border-white/15 focus:border-amber-500 rounded-lg text-sm text-white placeholder-slate-500 outline-none"
                        />
                      )}
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/10 hover:bg-white/16 disabled:opacity-60 text-amber-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>
                          {adminStatus && !adminStatus.claimed
                            ? 'Claim & Unlock Admin Studio'
                            : 'Verify Admin Passcode'}
                        </span>
                      </button>
                    </form>
                  </div>
                )}

                {notice && (
                  <div className="text-xs text-emerald-200 bg-emerald-950/70 border border-emerald-500/35 rounded-lg px-3.5 py-2.5 leading-relaxed">
                    {notice}
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="text-xs text-rose-200 bg-rose-950/70 border border-rose-500/35 rounded-lg px-3.5 py-2.5 leading-relaxed"
                  >
                    {error}
                  </div>
                )}

                <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    All Firebase keys are connected automatically. Profiles, Instagram IDs, custom
                    homes & Green Coins persist in Cloud Firestore.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="relative z-10 w-full max-w-[1440px] mx-auto px-6 md:px-12 py-4 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 shrink-0">
        <span>TYPIXEL OPEN WORLD · Green Valley (840m × 840m)</span>
        <span>WASD Move · Mouse Orbit · E Interact · ESC Menu</span>
      </footer>

      {/* Setup Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#111920] border border-white/15 rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
              <h2 className="font-display text-lg font-bold text-white">
                Firebase Auth & Admin Setup Guide
              </h2>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close setup guide"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-slate-300 list-decimal pl-5 leading-relaxed">
              <li>
                Firebase project credentials are wired automatically via{' '}
                <code className="font-mono text-xs text-emerald-300">firebase-applet-config.json</code> — no manual key entry needed.
              </li>
              <li>
                Google Sign-In works immediately. To also enable Email/Password Sign-Up, toggle{' '}
                <strong>Authentication → Sign-in method → Email/Password</strong> in your Firebase Console.
              </li>
              <li>
                For Admin Studio, sign in with the bootstrapped owner Google account or unlock via
                Admin Passcode (configurable via <code className="font-mono text-xs text-amber-300">ADMIN_PASSCODE</code> secret or first-run claim).
              </li>
              <li>
                Walk physically up to any vehicle in Green Valley and press <strong>E</strong> to
                ride free bicycles or rent/buy cars, motorcycles, SUVs, and the SkyCab Aero Taxi.
              </li>
            </ol>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
