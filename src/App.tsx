import { useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  loadCustomHomes,
  loadPlayerProfile,
  loadWalletTransactions,
  loadWorldProperties,
} from './lib/firebase.ts';
import { multiplayer } from './lib/multiplayer.ts';
import { useGameStore } from './store/gameStore.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { CharacterCreator } from './components/CharacterCreator.tsx';
import {
  WorldViewport,
  type MobileInputState,
} from './components/WorldViewport.tsx';
import { GameHUD } from './components/GameHUD.tsx';

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
  const setTransactions = useGameStore((s) => s.setTransactions);
  const setAdminSession = useGameStore((s) => s.setAdminSession);
  const resetForLogout = useGameStore((s) => s.resetForLogout);

  const mobileInputRef = useRef<MobileInputState>({
    moveX: 0,
    moveY: 0,
    sprint: false,
    jump: false,
  });
  const interactTriggerRef = useRef<(() => void) | null>(null);

  // Subscribe to Firebase Authentication session state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        multiplayer.disconnect();
        setAuthUser(null, true);
        resetForLogout();
        return;
      }

      setAuthUser(user, true);

      // Auto-elevate bootstrapped owner email (also re-verified server-side on ID token!)
      const existingToken = useGameStore.getState().adminToken;
      if (user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified) {
        setAdminSession(true, existingToken);
      }

      try {
        const [existingProfile, propsMap, homesMap, txs] = await Promise.all([
          loadPlayerProfile(user.uid),
          loadWorldProperties().catch(() => ({})),
          loadCustomHomes().catch(() => ({})),
          loadWalletTransactions(user.uid).catch(() => []),
        ]);
        setWorldProperties(propsMap);
        setCustomHomes(homesMap);
        setTransactions(txs);

        if (existingProfile) {
          setProfile(existingProfile);
          setScreen('world');
        } else {
          setProfile(null);
          setScreen('character', false);
        }
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
    setAdminSession,
    setAuthUser,
    setCustomHomes,
    setProfile,
    setScreen,
    setTransactions,
    setWorldProperties,
  ]);

  // Connect real Socket.IO multiplayer session whenever authenticated player enters Green Valley
  useEffect(() => {
    if (screen !== 'world' || !firebaseUser || !profile) return;

    const knownProps = Object.values(useGameStore.getState().worldProperties);
    const knownHomes = Object.values(useGameStore.getState().customHomes);
    void multiplayer.connect(firebaseUser, profile, knownProps, knownHomes);

    return () => {
      multiplayer.disconnect();
    };
    // Only reconnect when switching into/out of world or changing authenticated user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, firebaseUser?.uid]);

  if (screen === 'loading') {
    return (
      <div className="w-full h-screen bg-[#0b1014] text-[#f4f7f5] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="font-display text-sm font-medium text-slate-300">
          Loading TYPIXEL OPEN WORLD...
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
      <WorldViewport
        mobileInputRef={mobileInputRef}
        onInteractTriggerRef={interactTriggerRef}
      />
      <GameHUD
        mobileInputRef={mobileInputRef}
        onInteract={() => interactTriggerRef.current?.()}
      />
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
