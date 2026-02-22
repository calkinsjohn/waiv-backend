"use client";

const APPLE_MUSIC_SESSION_KEY = "waiv.apple_music_session_v1";
const LEGACY_APPLE_MUSIC_SESSION_KEY = "airwaves.apple_music_session_v1";

type AppleMusicSession = {
  connected: boolean;
  connectedAt: string;
  userToken?: string;
};

function readSessionRaw(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const current = window.localStorage.getItem(APPLE_MUSIC_SESSION_KEY);
  if (current !== null) {
    return current;
  }

  const legacy = window.localStorage.getItem(LEGACY_APPLE_MUSIC_SESSION_KEY);
  if (legacy !== null) {
    window.localStorage.setItem(APPLE_MUSIC_SESSION_KEY, legacy);
    return legacy;
  }

  return null;
}

export function hasAppleMusicSession(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const raw = readSessionRaw();
  if (!raw) {
    return false;
  }

  try {
    const session = JSON.parse(raw) as Partial<AppleMusicSession>;
    return session.connected === true || typeof session.userToken === "string";
  } catch {
    return false;
  }
}

export function saveAppleMusicSession(userToken?: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const session: AppleMusicSession = {
    connected: true,
    connectedAt: new Date().toISOString(),
    userToken,
  };

  window.localStorage.setItem(APPLE_MUSIC_SESSION_KEY, JSON.stringify(session));
  window.localStorage.removeItem(LEGACY_APPLE_MUSIC_SESSION_KEY);
}

export function clearAppleMusicSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(APPLE_MUSIC_SESSION_KEY);
  window.localStorage.removeItem(LEGACY_APPLE_MUSIC_SESSION_KEY);
}

export function subscribeAppleMusicSession(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === APPLE_MUSIC_SESSION_KEY || event.key === LEGACY_APPLE_MUSIC_SESSION_KEY) {
      callback();
    }
  };

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}
