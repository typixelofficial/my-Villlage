import { useGameStore } from '../store/gameStore.ts';

interface VoiceSignalingCallbacks {
  emitJoin: (muted: boolean) => void;
  emitLeave: () => void;
  emitState: (muted: boolean) => void;
  emitOffer: (targetUid: string, sdp: RTCSessionDescriptionInit) => void;
  emitAnswer: (targetUid: string, sdp: RTCSessionDescriptionInit) => void;
  emitIce: (targetUid: string, candidate: RTCIceCandidateInit) => void;
}

interface RemotePeerHandle {
  uid: string;
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  analyser: AnalyserNode | null;
  sourceNode: MediaStreamAudioSourceNode | null;
  pendingIce: RTCIceCandidateInit[];
  remoteDescSet: boolean;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

class VoiceChatManager {
  private callbacks: VoiceSignalingCallbacks | null = null;
  private localStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private peers = new Map<string, RemotePeerHandle>();
  private meterTimerId: number | null = null;
  private meterData = new Uint8Array(64);

  bindSignaling(callbacks: VoiceSignalingCallbacks | null): void {
    this.callbacks = callbacks;
  }

  async joinVoice(): Promise<boolean> {
    const store = useGameStore.getState();
    if (store.voiceJoined && this.localStream) return true;
    store.setVoiceError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const msg = 'Your browser does not support live microphone voice chat.';
      store.setVoiceError(msg);
      store.pushToast('Voice Unavailable', msg, 'rose');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.localStream = stream;
      this.setupLocalAnalyser(stream);

      store.setVoiceJoined(true);
      store.setVoiceMuted(false);
      store.setVoiceError(null);
      store.pushToast(
        'Voice Talk Live',
        'You can now talk with online players in Green Valley. Press V to mute/unmute.',
        'emerald',
      );

      this.callbacks?.emitJoin(false);
      this.startMetersLoop();
      return true;
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name || '';
      let msg = 'Unable to access your microphone.';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        msg = 'Microphone permission denied. Allow microphone access in your browser to talk online.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        msg = 'No microphone detected on this device. You can still use live text chat.';
      }
      store.setVoiceError(msg);
      store.pushToast('Microphone Needed', msg, 'amber');
      return false;
    }
  }

  leaveVoice(silent = false): void {
    const wasJoined = useGameStore.getState().voiceJoined;

    if (this.meterTimerId !== null) {
      window.clearInterval(this.meterTimerId);
      this.meterTimerId = null;
    }

    for (const uid of Array.from(this.peers.keys())) {
      this.closePeer(uid);
    }

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    this.localAnalyser = null;
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    if (wasJoined) {
      this.callbacks?.emitLeave();
    }

    useGameStore.getState().resetVoiceState();
    if (wasJoined && !silent) {
      useGameStore.getState().pushToast('Voice Disconnected', 'Microphone turned off.', 'sky');
    }
  }

  toggleMute(): void {
    const store = useGameStore.getState();
    if (!store.voiceJoined || !this.localStream) {
      void this.joinVoice();
      return;
    }
    const nextMuted = !store.voiceMuted;
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = !nextMuted;
    }
    store.setVoiceMuted(nextMuted);
    if (nextMuted) store.setLocalSpeaking(false);
    this.callbacks?.emitState(nextMuted);
  }

  setMode(mode: 'global' | 'proximity'): void {
    useGameStore.getState().setVoiceMode(mode);
    this.updatePeerVolumes();
  }

  // Called by multiplayer client when server sends currently active voice peers
  handleVoicePeers(peersList: { uid: string; muted: boolean }[]): void {
    const store = useGameStore.getState();
    const myUid = store.firebaseUser?.uid;
    if (!myUid) return;

    for (const p of peersList) {
      if (p.uid === myUid) continue;
      store.upsertVoicePeer(p.uid, { muted: p.muted });
      if (store.voiceJoined && this.localStream) {
        void this.ensurePeerConnection(p.uid, myUid < p.uid);
      }
    }
  }

  handlePeerJoined(uid: string, muted: boolean): void {
    const store = useGameStore.getState();
    const myUid = store.firebaseUser?.uid;
    if (!myUid || uid === myUid) return;

    store.upsertVoicePeer(uid, { muted });
    if (store.voiceJoined && this.localStream) {
      void this.ensurePeerConnection(uid, myUid < uid);
    }
  }

  handlePeerLeft(uid: string): void {
    this.closePeer(uid);
    useGameStore.getState().removeVoicePeer(uid);
  }

  handlePeerState(uid: string, muted: boolean): void {
    const store = useGameStore.getState();
    if (store.voicePeers[uid]) {
      store.upsertVoicePeer(uid, { muted, speaking: muted ? false : store.voicePeers[uid].speaking });
    }
  }

  async handleOffer(fromUid: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const store = useGameStore.getState();
    if (!store.voiceJoined || !this.localStream) return;

    const handle = await this.ensurePeerConnection(fromUid, false);
    if (!handle) return;

    try {
      await handle.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      handle.remoteDescSet = true;
      await this.flushPendingIce(handle);

      const answer = await handle.pc.createAnswer();
      await handle.pc.setLocalDescription(answer);
      this.callbacks?.emitAnswer(fromUid, answer);
    } catch (err) {
      console.warn('Voice handleOffer failed:', err);
    }
  }

  async handleAnswer(fromUid: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const handle = this.peers.get(fromUid);
    if (!handle) return;
    try {
      await handle.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      handle.remoteDescSet = true;
      await this.flushPendingIce(handle);
    } catch (err) {
      console.warn('Voice handleAnswer failed:', err);
    }
  }

  async handleIce(fromUid: string, candidate: RTCIceCandidateInit): Promise<void> {
    const handle = this.peers.get(fromUid);
    if (!handle) return;
    if (!handle.remoteDescSet) {
      if (handle.pendingIce.length < 40) {
        handle.pendingIce.push(candidate);
      }
      return;
    }
    try {
      await handle.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Ignore late/stale ICE candidates
    }
  }

  private async flushPendingIce(handle: RemotePeerHandle): Promise<void> {
    while (handle.pendingIce.length > 0) {
      const next = handle.pendingIce.shift();
      if (!next) continue;
      try {
        await handle.pc.addIceCandidate(new RTCIceCandidate(next));
      } catch {
        // Ignore stale candidate
      }
    }
  }

  private async ensurePeerConnection(
    remoteUid: string,
    shouldOffer: boolean,
  ): Promise<RemotePeerHandle | null> {
    if (!this.localStream) return null;
    const existing = this.peers.get(remoteUid);
    if (existing) return existing;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    audioEl.setAttribute('playsinline', 'true');
    audioEl.volume = 1;

    const handle: RemotePeerHandle = {
      uid: remoteUid,
      pc,
      audioEl,
      analyser: null,
      sourceNode: null,
      pendingIce: [],
      remoteDescSet: false,
    };
    this.peers.set(remoteUid, handle);

    for (const track of this.localStream.getAudioTracks()) {
      pc.addTrack(track, this.localStream);
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.callbacks?.emitIce(remoteUid, ev.candidate.toJSON());
      }
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0];
      if (!stream) return;
      audioEl.srcObject = stream;
      void audioEl.play().catch(() => {});
      this.attachRemoteAnalyser(handle, stream);
      useGameStore.getState().upsertVoicePeer(remoteUid, { connected: true });
      this.updatePeerVolumes();
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') {
        useGameStore.getState().upsertVoicePeer(remoteUid, { connected: true });
      } else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
        useGameStore.getState().upsertVoicePeer(remoteUid, { connected: false, speaking: false });
      }
    };

    if (shouldOffer) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.callbacks?.emitOffer(remoteUid, offer);
      } catch (err) {
        console.warn('Voice createOffer failed:', err);
      }
    }

    return handle;
  }

  private closePeer(uid: string): void {
    const handle = this.peers.get(uid);
    if (!handle) return;
    try {
      handle.sourceNode?.disconnect();
      handle.pc.onicecandidate = null;
      handle.pc.ontrack = null;
      handle.pc.onconnectionstatechange = null;
      handle.pc.close();
      handle.audioEl.pause();
      handle.audioEl.srcObject = null;
    } catch {
      // Ignore cleanup errors
    }
    this.peers.delete(uid);
  }

  private setupLocalAnalyser(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioCtx = new AudioCtx();
      const src = this.audioCtx.createMediaStreamSource(stream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      this.localAnalyser = analyser;
    } catch {
      this.localAnalyser = null;
    }
  }

  private attachRemoteAnalyser(handle: RemotePeerHandle, stream: MediaStream): void {
    if (!this.audioCtx) return;
    try {
      const src = this.audioCtx.createMediaStreamSource(stream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      handle.sourceNode = src;
      handle.analyser = analyser;
    } catch {
      handle.analyser = null;
    }
  }

  private readSpeakingLevel(analyser: AnalyserNode | null): boolean {
    if (!analyser) return false;
    analyser.getByteFrequencyData(this.meterData);
    let sum = 0;
    for (let i = 0; i < this.meterData.length; i++) {
      sum += this.meterData[i];
    }
    return sum / this.meterData.length > 14;
  }

  private updatePeerVolumes(): void {
    const store = useGameStore.getState();
    const isProx = store.voiceMode === 'proximity';
    const localPos = store.localPos;

    for (const [uid, handle] of this.peers.entries()) {
      if (!isProx) {
        handle.audioEl.volume = 1;
        continue;
      }
      const rp = store.remotePlayers[uid];
      if (!rp) {
        handle.audioEl.volume = 0.6;
        continue;
      }
      const dist = Math.hypot(localPos.x - rp.x, localPos.z - rp.z);
      // Full volume <= 8m, smooth fade to 0 at 48m
      const vol = dist <= 8 ? 1 : dist >= 48 ? 0 : 1 - (dist - 8) / 40;
      handle.audioEl.volume = Math.max(0, Math.min(1, vol));
    }
  }

  private startMetersLoop(): void {
    if (this.meterTimerId !== null) window.clearInterval(this.meterTimerId);
    this.meterTimerId = window.setInterval(() => {
      const store = useGameStore.getState();
      if (!store.voiceJoined) return;

      const localTalking = !store.voiceMuted && this.readSpeakingLevel(this.localAnalyser);
      if (store.localSpeaking !== localTalking) {
        store.setLocalSpeaking(localTalking);
      }

      for (const [uid, handle] of this.peers.entries()) {
        const peerState = store.voicePeers[uid];
        const talking = Boolean(
          peerState && !peerState.muted && this.readSpeakingLevel(handle.analyser),
        );
        if (peerState && peerState.speaking !== talking) {
          store.upsertVoicePeer(uid, { speaking: talking });
        }
      }

      this.updatePeerVolumes();
    }, 180);
  }
}

export const voiceChat = new VoiceChatManager();
