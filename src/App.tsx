import { lazy, Suspense, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  findMatchingHomeForPlayer,
  loadCustomHomes,
  loadCustomShops,
  loadPlayerProfile,
  loadPublicAds,
  loadWalletTransactions,
  loadWorldProperties,
} from './lib/firebase.ts';
import { multiplayer } from './lib/multiplayer.ts';
import { useGameStore } from './store/gameStore.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { CharacterCreator } from './components/CharacterCreator.tsx';
import type { MobileInputState } from './components/WorldViewport.tsx';

const WorldViewport = lazy(() =>
  import('./components/WorldViewport.tsx').then((m) => ({ default: m.WorldViewport })),
);
const GameHUD = lazy(() =>
  import('./components/GameHUD.tsx').then((m) => ({ default: m.GameHUD })),
);

const BOOTSTRAPPED_ADMIN_EMAIL = 'hashimtypixel@gmail.com';

function GameShell() {
  const screen = useGameStore((s) => s.screen);
  const firebaseUser = useGameStore((s) => s.firebaseUser);
  const profile = useGameStore((s) => s.profile);
  const setAuthUser = useGameStore((s) => s.setAuthUser);
  const setProfile = useGameStore((s) => s.setProfile);
  const setScreen = useGameStore((s) => s.setScreen);
  const setWorldProperties = useGameStore((s) => s.setWorldProperties);
  const setCustomHomes = useGameStore((s) => s.setCustomHomes);
  const setCustomShops = useGameStore((s) => s.setCustomShops);
  const setPublicAds = useGameStore((s) => s.setPublicAds);
  const setTransactions = useGameStore((s) => s.setTransactions);
  const setIsAdmin = useGameStore((s) => s.setIsAdmin);
  const resetForLogout = useGameStore((s) => s.resetForLogout);

  const mobileInputRef = useRef<MobileInputState>({
    moveX: 0,
    moveY: 0,
    sprint: false,
    jump: false,
  });
  const interactTriggerRef = useRef<(() => void) | null>(null);

  // Instant Boot Failsafe: Never stay stuck on dark loading screen if Firebase takes > 2.5s
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const st = useGameStore.getState();
      if (st.screen === 'loading' && !st.firebaseUser) {
        st.setAuthUser(null, true);
        st.setScreen('login');
      }
    }, 2500);
    return () => window.clearTimeout(timer);
  }, []);

  // Fast, Non-Blocking Firebase Session Hydration + Auto-Reach Home by UID/Instagram
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        multiplayer.disconnect();
        setAuthUser(null, true);
        resetForLogout();
        return;
      }

      setAuthUser(user, true);
      const hasAdminToken = Boolean(useGameStore.getState().adminBearerToken);
      setIsAdmin(
        hasAdminToken || (user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified),
      );

      try {
        const [existingProfile, homesMap] = await Promise.all([
          loadPlayerProfile(user.uid),
          loadCustomHomes().catch(() => ({})),
        ]);
        setCustomHomes(homesMap);

        if (existingProfile) {
          const matchedHome = findMatchingHomeForPlayer(existingProfile, homesMap);
          const spawnProfile = matchedHome
            ? {
                ...existingProfile,
                lastPosition: {
                  x: matchedHome.x,
                  y: matchedHome.y,
                  z: matchedHome.z + 9.5,
                },
              }
            : existingProfile;

          setProfile(spawnProfile);
          setScreen('world');

          if (matchedHome) {
            useGameStore.getState().pushToast(
              `Welcome Home to ${matchedHome.name}!`,
              matchedHome.ownerInstagram
                ? `Matched @${matchedHome.ownerInstagram} — arrived directly at your residence.`
                : 'Arrived directly at your Green Valley residence.',
              'emerald',
            );
          }
        } else {
          setProfile(null);
          setScreen('character', false);
        }

        // Hydrate secondary collections asynchronously without blocking 3D entry
        void Promise.all([
          loadWorldProperties().then(setWorldProperties).catch(() => {}),
          loadCustomShops().then(setCustomShops).catch(() => {}),
          loadPublicAds().then(setPublicAds).catch(() => {}),
          loadWalletTransactions(user.uid).then(setTransactions).catch(() => {}),
        ]);
      } catch (err) {
        console.error('Error hydrating player profile:', err);
        setScreen('character', false);
      }
    });

    return () => {
      unsub();
    };
  }, [
    resetForLogout,
    setIsAdmin,
    setAuthUser,
    setCustomHomes,
    setCustomShops,
    setPublicAds,
    setProfile,
    setScreen,
    setTransactions,
    setWorldProperties,
  ]);

  // Connect real Socket.IO multiplayer session whenever authenticated player enters Green Valley
  useEffect(() => {
    if (screen !== 'world' || !firebaseUser || !profile) return;

    const st = useGameStore.getState();
    void multiplayer.connect(
      firebaseUser,
      profile,
      Object.values(st.worldProperties),
      Object.values(st.customHomes),
      Object.values(st.customShops),
      st.publicAds,
    );

    return () => {
      multiplayer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, firebaseUser?.uid]);

  if (screen === 'loading') {
    return (
      <div className="w-full h-screen bg-[#0b1014] text-[#f4f7f5] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="font-display text-sm font-medium text-slate-300">
          Loading TYPIXEL Green Valley...
        </p>
      </div>
    );
  }

  if (screen === 'login' || !firebaseUser) {
    return <LoginScreen />;
  }

  if (screen === 'character' || !profile) {
    return <CharacterCreator />;
  }

  return (
    <main className="relative w-full h-screen overflow-hidden bg-[#0b1014]">
      <Suspense
        fallback={
          <div className="w-full h-screen bg-[#0b1014] text-slate-200 flex flex-col items-center justify-center gap-3">
            <div className="w-9 h-9 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <p className="font-display text-sm font-semibold">Launching 3D Green Valley...</p>
          </div>
        }
      >
        <WorldViewport
          mobileInputRef={mobileInputRef}
          onInteractTriggerRef={interactTriggerRef}
        />
        <GameHUD
          mobileInputRef={mobileInputRef}
          onInteract={() => interactTriggerRef.current?.()}
        />
      </Suspense>
    </main>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GameShell />
    </ErrorBoundary>
  );
}
