"use client";

import { buildCanonicalTrackKey } from "./trackIdentity";

const HISTORY_STORAGE_KEY = "waiv.listening_history_v2";
const LEGACY_HISTORY_STORAGE_KEY = "airwaves.listening_history_v2";
const MAX_EVENT_HISTORY = 2500;
const MAX_SESSION_HISTORY = 240;
const SESSION_RETENTION_DAYS = 180;

export type TrackHistory = {
  key: string;
  title: string;
  artistName: string;
  playCount: number;
  firstPlayedAt: string;
  lastPlayedAt: string;
};

export type PlaybackSource = "library" | "suggestion";
export type ListeningModeType = "tune-in" | "playlist" | "unknown";

export type PlaybackHistoryEvent = {
  id: string;
  trackId: string | null;
  trackKey: string;
  title: string;
  artistName: string;
  artistKey: string;
  genreKey: string | null;
  source: PlaybackSource;
  mode: ListeningModeType;
  sessionId: string | null;
  playedAt: string;
};

export type ListeningSessionHistory = {
  sessionId: string;
  mode: ListeningModeType;
  startedAt: string;
};

type HistoryPayload = {
  version: 2;
  tracks: Record<string, TrackHistory>;
  events: PlaybackHistoryEvent[];
  sessions: Record<string, ListeningSessionHistory>;
};

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildPlaybackTrackKey(input: { title: string; artistName: string }): string {
  return buildCanonicalTrackKey({
    title: input.title,
    artistName: input.artistName,
  });
}

function toIsoOrNow(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

function toPlaybackSource(value: unknown): PlaybackSource {
  return value === "suggestion" ? "suggestion" : "library";
}

function toListeningMode(value: unknown): ListeningModeType {
  if (value === "tune-in" || value === "playlist") {
    return value;
  }
  return "unknown";
}

function parseTrackHistory(key: string, raw: unknown): TrackHistory | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const value = raw as Partial<TrackHistory>;
  if (typeof value.title !== "string" || typeof value.artistName !== "string") {
    return null;
  }

  const playCount =
    typeof value.playCount === "number" && Number.isFinite(value.playCount) && value.playCount > 0
      ? Math.floor(value.playCount)
      : 1;

  const firstPlayedAt = toIsoOrNow(value.firstPlayedAt);
  const lastPlayedAt = toIsoOrNow(value.lastPlayedAt);

  return {
    key,
    title: value.title,
    artistName: value.artistName,
    playCount,
    firstPlayedAt,
    lastPlayedAt,
  };
}

function parsePlaybackEvent(raw: unknown): PlaybackHistoryEvent | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const value = raw as Partial<PlaybackHistoryEvent>;
  if (
    typeof value.trackKey !== "string" ||
    typeof value.title !== "string" ||
    typeof value.artistName !== "string"
  ) {
    return null;
  }

  const normalizedTrackKey =
    value.trackKey.trim() || buildPlaybackTrackKey({ title: value.title, artistName: value.artistName });
  const artistKey = normalizeToken(value.artistName);
  if (!normalizedTrackKey || !artistKey) {
    return null;
  }

  const genreKey = typeof value.genreKey === "string" && value.genreKey.trim() ? value.genreKey.trim() : null;
  const trackId = typeof value.trackId === "string" && value.trackId.trim() ? value.trackId.trim() : null;
  const sessionId = typeof value.sessionId === "string" && value.sessionId.trim() ? value.sessionId.trim() : null;

  return {
    id:
      typeof value.id === "string" && value.id.trim()
        ? value.id
        : `${toIsoOrNow(value.playedAt)}::${normalizedTrackKey}::${Math.random().toString(36).slice(2, 9)}`,
    trackId,
    trackKey: normalizedTrackKey,
    title: value.title,
    artistName: value.artistName,
    artistKey,
    genreKey,
    source: toPlaybackSource(value.source),
    mode: toListeningMode(value.mode),
    sessionId,
    playedAt: toIsoOrNow(value.playedAt),
  };
}

function parseSessionHistory(raw: unknown): ListeningSessionHistory | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const value = raw as Partial<ListeningSessionHistory>;
  if (typeof value.sessionId !== "string" || !value.sessionId.trim()) {
    return null;
  }

  return {
    sessionId: value.sessionId.trim(),
    mode: toListeningMode(value.mode),
    startedAt: toIsoOrNow(value.startedAt),
  };
}

function emptyPayload(): HistoryPayload {
  return {
    version: 2,
    tracks: {},
    events: [],
    sessions: {},
  };
}

function readPayload(): HistoryPayload {
  if (typeof window === "undefined") {
    return emptyPayload();
  }

  const rawCurrent = window.localStorage.getItem(HISTORY_STORAGE_KEY);
  const rawLegacy = window.localStorage.getItem(LEGACY_HISTORY_STORAGE_KEY);
  const raw = rawCurrent ?? rawLegacy;
  if (!raw) {
    return emptyPayload();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<HistoryPayload> & {
      tracks?: Record<string, unknown>;
      events?: unknown[];
      sessions?: Record<string, unknown>;
    };

    const tracks: Record<string, TrackHistory> = {};
    if (parsed.tracks && typeof parsed.tracks === "object") {
      for (const [key, value] of Object.entries(parsed.tracks)) {
        const track = parseTrackHistory(key, value);
        if (track) {
          tracks[key] = track;
        }
      }
    }

    const events = Array.isArray(parsed.events)
      ? parsed.events
          .map((entry) => parsePlaybackEvent(entry))
          .filter((entry): entry is PlaybackHistoryEvent => entry !== null)
      : [];

    const sessions: Record<string, ListeningSessionHistory> = {};
    if (parsed.sessions && typeof parsed.sessions === "object") {
      for (const value of Object.values(parsed.sessions)) {
        const session = parseSessionHistory(value);
        if (session) {
          sessions[session.sessionId] = session;
        }
      }
    }

    const payload: HistoryPayload = {
      version: 2,
      tracks,
      events,
      sessions,
    };
    if (!rawCurrent && rawLegacy) {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(payload));
    }
    return payload;
  } catch {
    return emptyPayload();
  }
}

function writePayload(payload: HistoryPayload): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(payload));
  window.localStorage.removeItem(LEGACY_HISTORY_STORAGE_KEY);
}

function pruneEvents(events: PlaybackHistoryEvent[]): PlaybackHistoryEvent[] {
  if (events.length <= MAX_EVENT_HISTORY) {
    return events;
  }
  return events.slice(events.length - MAX_EVENT_HISTORY);
}

function pruneSessions(sessions: Record<string, ListeningSessionHistory>): Record<string, ListeningSessionHistory> {
  const values = Object.values(sessions)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const cutoffMs = Date.now() - SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const kept = values.filter((session, index) => {
    if (index >= MAX_SESSION_HISTORY) {
      return false;
    }
    const ts = new Date(session.startedAt).getTime();
    if (!Number.isFinite(ts)) {
      return true;
    }
    return ts >= cutoffMs;
  });

  const next: Record<string, ListeningSessionHistory> = {};
  for (const session of kept) {
    next[session.sessionId] = session;
  }
  return next;
}

export function getTrackHistory(trackKey: string): TrackHistory | null {
  const payload = readPayload();
  return payload.tracks[trackKey] ?? null;
}

export function getPlaybackHistoryEvents(options?: {
  maxEvents?: number;
  sinceDays?: number;
  mode?: ListeningModeType;
}): PlaybackHistoryEvent[] {
  const payload = readPayload();
  let events = payload.events;

  if (options?.mode) {
    events = events.filter((event) => event.mode === options.mode);
  }

  if (typeof options?.sinceDays === "number" && Number.isFinite(options.sinceDays) && options.sinceDays > 0) {
    const cutoffMs = Date.now() - options.sinceDays * 24 * 60 * 60 * 1000;
    events = events.filter((event) => {
      const ts = new Date(event.playedAt).getTime();
      return Number.isFinite(ts) && ts >= cutoffMs;
    });
  }

  if (typeof options?.maxEvents === "number" && Number.isFinite(options.maxEvents) && options.maxEvents > 0) {
    return events.slice(Math.max(0, events.length - Math.floor(options.maxEvents)));
  }

  return events;
}

export function registerListeningSession(input: {
  sessionId: string;
  mode: ListeningModeType;
  startedAt?: Date;
}): void {
  const sessionId = input.sessionId.trim();
  if (!sessionId) {
    return;
  }

  const payload = readPayload();
  payload.sessions[sessionId] = {
    sessionId,
    mode: toListeningMode(input.mode),
    startedAt: toIsoOrNow(input.startedAt),
  };
  payload.sessions = pruneSessions(payload.sessions);
  writePayload(payload);
}

export function recordTrackPlay(input: {
  key: string;
  title: string;
  artistName: string;
  trackId?: string | null;
  genreTag?: string | null;
  source?: PlaybackSource;
  mode?: ListeningModeType;
  sessionId?: string | null;
  playedAt?: Date;
}): TrackHistory {
  const payload = readPayload();
  const title = input.title.trim();
  const artistName = input.artistName.trim();
  const canonicalTrackKey = buildPlaybackTrackKey({ title, artistName });
  const historyKey = input.key.trim() || canonicalTrackKey;
  const existing = payload.tracks[historyKey];
  const playedAt = toIsoOrNow(input.playedAt);

  const updated: TrackHistory = existing
    ? {
        ...existing,
        title,
        artistName,
        playCount: existing.playCount + 1,
        lastPlayedAt: playedAt,
      }
    : {
        key: historyKey,
        title,
        artistName,
        playCount: 1,
        firstPlayedAt: playedAt,
        lastPlayedAt: playedAt,
      };

  payload.tracks[historyKey] = updated;

  const artistKey = normalizeToken(artistName);
  const genreKey = typeof input.genreTag === "string" && input.genreTag.trim().length > 0
    ? normalizeToken(input.genreTag)
    : null;
  const trackId = typeof input.trackId === "string" && input.trackId.trim().length > 0
    ? input.trackId.trim()
    : null;
  const sessionId = typeof input.sessionId === "string" && input.sessionId.trim().length > 0
    ? input.sessionId.trim()
    : null;
  const source = toPlaybackSource(input.source);
  const mode = toListeningMode(input.mode);

  if (sessionId && !payload.sessions[sessionId]) {
    payload.sessions[sessionId] = {
      sessionId,
      mode,
      startedAt: playedAt,
    };
  }

  payload.events = pruneEvents([
    ...payload.events,
    {
      id: `${playedAt}::${canonicalTrackKey}::${Math.random().toString(36).slice(2, 9)}`,
      trackId,
      trackKey: canonicalTrackKey || historyKey,
      title,
      artistName,
      artistKey,
      genreKey,
      source,
      mode,
      sessionId,
      playedAt,
    },
  ]);
  payload.sessions = pruneSessions(payload.sessions);

  writePayload(payload);
  return updated;
}
