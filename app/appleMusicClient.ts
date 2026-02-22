"use client";

import { clearAppleMusicSession, saveAppleMusicSession } from "./appleMusicSession";
import { getPlaybackHistoryEvents } from "./listeningHistoryStore";
import { isSoundtrackOrScoreLike } from "./mediaContentFilter";
import {
  buildConstrainedTuneInMix,
  type TuneInHistoryEntry,
} from "./tuneInMixSelector";
import {
  selectOpeningTrackByPriority,
  type TuneInFirstTrackSource,
  type TuneInOpeningTrackCandidate,
} from "./tuneInOpeningTrackSelector";
import { buildCanonicalTrackKey } from "./trackIdentity";

const MUSICKIT_SCRIPT_ID = "musickit-js";
const MUSICKIT_SCRIPT_SRC = "https://js-cdn.music.apple.com/musickit/v1/musickit.js";
const MUSICKIT_READY_TIMEOUT_MS = 10000;

let scriptPromise: Promise<void> | null = null;
let initPromise: Promise<MusicKitInstance> | null = null;
const TRACK_AVAILABILITY_CACHE_TTL_MS = 10 * 60 * 1000;
const TRACK_AVAILABILITY_BATCH_SIZE = 100;
const availabilityCache = new Map<string, { playable: boolean; expiresAtMs: number }>();

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function errorMessageFromUnknown(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "";
}

type MusicKitInstance = {
  isAuthorized?: boolean;
  musicUserToken?: string;
  authorize: () => Promise<string>;
  setQueue?: (options: { playlist?: string; songs?: string[] }) => Promise<unknown>;
  play?: () => Promise<void>;
  pause?: () => Promise<void>;
  stop?: () => Promise<void>;
  skipToNextItem?: () => Promise<void>;
  skipToPreviousItem?: () => Promise<void>;
  skipToNextEntry?: () => Promise<void>;
  skipToPreviousEntry?: () => Promise<void>;
  isPlaying?: boolean;
  shuffleMode?: number;
  player?: {
    nowPlayingItem?: unknown;
    currentPlaybackTime?: number;
    currentPlaybackDuration?: number;
    isPlaying?: boolean;
    play?: () => Promise<void>;
    pause?: () => Promise<void>;
    stop?: () => Promise<void>;
    skipToNextItem?: () => Promise<void>;
    skipToPreviousItem?: () => Promise<void>;
    skipToNextEntry?: () => Promise<void>;
    skipToPreviousEntry?: () => Promise<void>;
    volume?: number;
  };
  nowPlayingItem?: unknown;
  currentPlaybackTime?: number;
  currentPlaybackDuration?: number;
  playbackState?: number;
  volume?: number;
  api?: {
    music: (
      path: string
    ) => Promise<{
      data?: unknown[];
      next?: string;
    }>;
  };
};

type MusicKitGlobal = {
  configure: (config: {
    developerToken: string;
    app: {
      name: string;
      build: string;
    };
  }) => void;
  getInstance: () => MusicKitInstance;
};

type MusicKitController = NonNullable<MusicKitInstance["player"]> | MusicKitInstance;

declare global {
  interface Window {
    MusicKit?: MusicKitGlobal;
  }
}

function isControllerPlaying(
  controller: MusicKitController,
  music: MusicKitInstance
): boolean {
  return Boolean(
    controller.isPlaying ??
      music.isPlaying ??
      (typeof music.playbackState === "number" && music.playbackState === 2)
  );
}

function getNowPlayingIdentity(
  controller: MusicKitController,
  music: MusicKitInstance
): string | null {
  const item = (controller.nowPlayingItem ?? music.nowPlayingItem) as
    | {
        id?: string | number;
        name?: string;
        title?: string;
        artistName?: string;
        attributes?: {
          name?: string;
          title?: string;
          artistName?: string;
          playParams?: {
            id?: string;
            catalogId?: string;
          };
        };
      }
    | undefined;

  const title = item?.attributes?.name ?? item?.attributes?.title ?? item?.title ?? item?.name;
  const artist = item?.attributes?.artistName ?? item?.artistName ?? "";
  const id =
    item?.attributes?.playParams?.catalogId ??
    item?.attributes?.playParams?.id ??
    item?.id ??
    (title ? `${title}::${artist}` : null);

  return id ? String(id) : null;
}

function getPlayFns(controller: MusicKitController, music: MusicKitInstance): {
  playPrimary: (() => Promise<void>) | null;
  playFallback: (() => Promise<void>) | null;
} {
  return {
    playPrimary: typeof controller.play === "function" ? controller.play.bind(controller) : null,
    playFallback:
      controller !== music && typeof music.play === "function" ? music.play.bind(music) : null,
  };
}

function getSkipNextFn(controller: MusicKitController): (() => Promise<void>) | null {
  if (typeof controller.skipToNextItem === "function") {
    return controller.skipToNextItem.bind(controller);
  }
  if (typeof controller.skipToNextEntry === "function") {
    return controller.skipToNextEntry.bind(controller);
  }
  return null;
}

function getSkipPreviousFn(controller: MusicKitController): (() => Promise<void>) | null {
  if (typeof controller.skipToPreviousItem === "function") {
    return controller.skipToPreviousItem.bind(controller);
  }
  if (typeof controller.skipToPreviousEntry === "function") {
    return controller.skipToPreviousEntry.bind(controller);
  }
  return null;
}

async function tryEnsurePlayingState(
  controller: MusicKitController,
  music: MusicKitInstance,
  options?: { attempts?: number; contextLabel?: string }
): Promise<boolean> {
  if (isControllerPlaying(controller, music)) {
    return true;
  }

  const attempts = Math.max(1, Math.min(8, options?.attempts ?? 3));
  const contextLabel = options?.contextLabel ?? "playback";
  const { playPrimary, playFallback } = getPlayFns(controller, music);

  if (!playPrimary && !playFallback) {
    return false;
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (playPrimary) {
      try {
        await withTimeout(
          playPrimary(),
          3400,
          `Timed out while starting ${contextLabel}.`
        );
      } catch {
        // Try fallback below.
      }
    }

    if (!isControllerPlaying(controller, music) && playFallback) {
      try {
        await withTimeout(
          playFallback(),
          3400,
          `Timed out while fallback starting ${contextLabel}.`
        );
      } catch {
        // Keep retrying.
      }
    }

    if (isControllerPlaying(controller, music)) {
      return true;
    }

    await sleep(140 + attempt * 60);
  }

  return isControllerPlaying(controller, music);
}

async function ensurePlayingState(
  controller: MusicKitController,
  music: MusicKitInstance,
  contextLabel = "playback"
): Promise<void> {
  const recovered = await tryEnsurePlayingState(controller, music, {
    attempts: 3,
    contextLabel,
  });
  if (!recovered) {
    throw new Error(`Could not restore ${contextLabel}.`);
  }
}

async function waitForTrackAdvance(
  controller: MusicKitController,
  music: MusicKitInstance,
  previousId: string | null,
  attempts = 8
): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    await sleep(170 + i * 35);
    const currentId = getNowPlayingIdentity(controller, music);
    if (previousId === null && currentId) {
      return true;
    }
    if (previousId && currentId && currentId !== previousId) {
      return true;
    }
  }
  return false;
}

async function skipForwardUntilPlayable(
  controller: MusicKitController,
  music: MusicKitInstance,
  options: {
    skipFn: () => Promise<void>;
    maxSkips?: number;
    contextLabel?: string;
    requireAdvance?: boolean;
    initialPreviousId?: string | null;
  }
): Promise<boolean> {
  const maxSkips = Math.max(1, Math.min(30, options.maxSkips ?? 12));
  const contextLabel = options.contextLabel ?? "playback";
  const requireAdvance = options.requireAdvance ?? true;
  let previousId =
    options.initialPreviousId ?? getNowPlayingIdentity(controller, music);

  for (let i = 0; i < maxSkips; i += 1) {
    try {
      await withTimeout(
        options.skipFn(),
        4200,
        `Timed out while skipping to a playable ${contextLabel} track.`
      );
    } catch {
      return false;
    }

    const advanced = await waitForTrackAdvance(controller, music, previousId, 12);
    previousId = getNowPlayingIdentity(controller, music);

    const playable = await tryEnsurePlayingState(controller, music, {
      attempts: 2,
      contextLabel,
    });
    if (playable && (advanced || !requireAdvance)) {
      return true;
    }
    if (playable && !requireAdvance) {
      return true;
    }
  }

  return false;
}

export async function ensureAppleMusicPlayback(options?: {
  maxResumeAttempts?: number;
  maxSkipAttempts?: number;
}): Promise<boolean> {
  const music = await initMusicKit();
  const controller = music.player ?? music;

  const resumed = await tryEnsurePlayingState(controller, music, {
    attempts: options?.maxResumeAttempts ?? 3,
    contextLabel: "playback",
  });
  if (resumed) {
    return true;
  }

  const skipNext = getSkipNextFn(controller);
  if (!skipNext || (options?.maxSkipAttempts ?? 0) <= 0) {
    return false;
  }

  return skipForwardUntilPlayable(controller, music, {
    skipFn: skipNext,
    maxSkips: options?.maxSkipAttempts ?? 8,
    contextLabel: "playback",
    requireAdvance: false,
  });
}

function getDeveloperToken(): string {
  const token = process.env.NEXT_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN;
  if (!token) {
    throw new Error(
      "Missing NEXT_PUBLIC_APPLE_MUSIC_DEVELOPER_TOKEN in .env.local"
    );
  }

  return token;
}

function loadMusicKitScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MusicKit can only be loaded in the browser."));
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (window.MusicKit) {
      resolve();
      return;
    }

    const existing = document.getElementById(MUSICKIT_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.MusicKit) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load MusicKit script.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = MUSICKIT_SCRIPT_ID;
    script.async = true;
    script.src = MUSICKIT_SCRIPT_SRC;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load MusicKit script.")), {
      once: true,
    });
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function waitForMusicKitGlobal(): Promise<MusicKitGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MusicKit can only be loaded in the browser."));
  }

  if (window.MusicKit) {
    return Promise.resolve(window.MusicKit);
  }

  return new Promise<MusicKitGlobal>((resolve, reject) => {
    const startedAt = Date.now();
    let settled = false;

    const finish = (musicKit: MusicKitGlobal) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearInterval(interval);
      document.removeEventListener("musickitloaded", onLoaded);
      resolve(musicKit);
    };

    const fail = () => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearInterval(interval);
      document.removeEventListener("musickitloaded", onLoaded);
      reject(new Error("MusicKit failed to become ready. Please refresh and try again."));
    };

    const onLoaded = () => {
      if (window.MusicKit) {
        finish(window.MusicKit);
      }
    };

    document.addEventListener("musickitloaded", onLoaded);

    const interval = window.setInterval(() => {
      if (window.MusicKit) {
        finish(window.MusicKit);
        return;
      }

      if (Date.now() - startedAt > MUSICKIT_READY_TIMEOUT_MS) {
        fail();
      }
    }, 100);
  });
}

export async function initMusicKit(): Promise<MusicKitInstance> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await loadMusicKitScript();

    const musicKit = await waitForMusicKitGlobal();

    musicKit.configure({
      developerToken: getDeveloperToken(),
      app: {
        name: "W.A.I.V.",
        build: "0.1.0",
      },
    });

    const instance = musicKit.getInstance();
    if (!instance) {
      throw new Error("MusicKit initialized, but no instance is available.");
    }

    return instance;
  })();

  return initPromise;
}

export async function authorizeAppleMusic(): Promise<string> {
  const music = await initMusicKit();
  const authorizeFn =
    typeof music.authorize === "function"
      ? music.authorize.bind(music)
      : null;

  if (!authorizeFn) {
    throw new Error(
      "MusicKit is loaded but authorize() is unavailable. This is usually a token/key configuration issue."
    );
  }

  const userToken = await authorizeFn();

  if (!userToken) {
    throw new Error("Apple Music authorization did not return a user token.");
  }

  clearAccountHistorySnapshotCache();
  saveAppleMusicSession(userToken);
  return userToken;
}

export async function getAppleMusicAuthorizationState(): Promise<{
  isAuthorized: boolean;
  userToken: string | null;
}> {
  try {
    const music = await initMusicKit();
    const userToken = music.musicUserToken ?? null;
    const isAuthorized = Boolean(music.isAuthorized || userToken);

    if (isAuthorized) {
      saveAppleMusicSession(userToken ?? undefined);
    } else {
      clearAccountHistorySnapshotCache();
      clearAppleMusicSession();
    }

    return { isAuthorized, userToken };
  } catch {
    return { isAuthorized: false, userToken: null };
  }
}

export async function signOutAppleMusic(): Promise<void> {
  try {
    const music = await initMusicKit();
    const unauthorizeFn =
      typeof (music as MusicKitInstance & { unauthorize?: () => void | Promise<void> }).unauthorize === "function"
        ? (music as MusicKitInstance & { unauthorize: () => void | Promise<void> }).unauthorize.bind(music)
        : null;

    if (unauthorizeFn) {
      await unauthorizeFn();
    }
  } finally {
    clearAccountHistorySnapshotCache();
    clearAppleMusicSession();
  }
}

export type AppleMusicPlaylist = {
  id: string;
  name: string;
  songCount: number | null;
};

export type AppleMusicRecentTrack = {
  id: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
};

export type AppleMusicNowPlaying = {
  id: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  albumId?: string | null;
  albumTitle?: string | null;
  progress: number;
  isPlaying: boolean;
};

export type AppleMusicPlaylistTrackRef = {
  id: string;
  title: string;
  artistName: string;
  genreTag?: string | null;
  albumId?: string | null;
  albumTitle?: string | null;
};

export type TuneInTrackSource = "library" | "suggestion";

export type AppleMusicTuneInTrackRef = {
  id: string;
  title: string;
  artistName: string;
  source: TuneInTrackSource;
  genreTag?: string | null;
  albumId?: string | null;
  albumTitle?: string | null;
};

export type AppleMusicTuneInSession = {
  tracks: AppleMusicTuneInTrackRef[];
  libraryCount: number;
  suggestionCount: number;
  firstTrackSource: TuneInFirstTrackSource;
  firstTrackId: string;
};

export type AppleMusicTrackIdentity = {
  title: string;
  artistName: string;
};

export type AppleMusicTrackHistorySignal = {
  recentPlayedRank: number | null;
  recentPlayedSampleSize: number;
  heavyRotationRank: number | null;
  heavyRotationSampleSize: number;
  inRecentPlayed: boolean;
  inHeavyRotation: boolean;
};

type AppleMusicAccountHistorySnapshot = {
  recentPlayedRanks: Map<string, number>;
  heavyRotationRanks: Map<string, number>;
  recentPlayedSampleSize: number;
  heavyRotationSampleSize: number;
  expiresAtMs: number;
};

const ACCOUNT_HISTORY_SNAPSHOT_TTL_MS = 2 * 60 * 1000;
let accountHistorySnapshotCache: AppleMusicAccountHistorySnapshot | null = null;
let accountHistorySnapshotPromise: Promise<AppleMusicAccountHistorySnapshot | null> | null = null;

function buildArtworkUrl(template: string | undefined, size = 96): string | null {
  if (!template) {
    return null;
  }

  return template.replace("{w}", String(size)).replace("{h}", String(size));
}

function buildTrackHistoryKey(track: AppleMusicTrackIdentity): string {
  return buildCanonicalTrackKey({
    title: track.title,
    artistName: track.artistName,
  });
}

type AppleMusicTrackResource = {
  id?: string;
  type?: string;
  attributes?: {
    name?: string;
    title?: string;
    artistName?: string;
  };
  name?: string;
  title?: string;
  artistName?: string;
};

function extractTrackIdentityFromResource(resource: unknown): AppleMusicTrackIdentity | null {
  if (!resource || typeof resource !== "object") {
    return null;
  }

  const item = resource as AppleMusicTrackResource;
  const title = item.attributes?.name ?? item.attributes?.title ?? item.name ?? item.title;
  const artistName = item.attributes?.artistName ?? item.artistName;
  if (typeof title !== "string" || typeof artistName !== "string") {
    return null;
  }

  const cleanTitle = title.trim();
  const cleanArtist = artistName.trim();
  if (!cleanTitle || !cleanArtist) {
    return null;
  }

  return {
    title: cleanTitle,
    artistName: cleanArtist,
  };
}

function buildTrackRankMap(tracks: AppleMusicTrackIdentity[]): Map<string, number> {
  const ranks = new Map<string, number>();
  for (let i = 0; i < tracks.length; i += 1) {
    const key = buildTrackHistoryKey(tracks[i]);
    if (!key || ranks.has(key)) {
      continue;
    }
    ranks.set(key, i + 1);
  }
  return ranks;
}

async function fetchTrackFeedFromCandidatePaths(
  candidatePaths: string[],
  music: MusicKitInstance,
  options?: { maxItems?: number; maxPages?: number }
): Promise<AppleMusicTrackIdentity[]> {
  const maxItems = Math.max(20, Math.min(300, options?.maxItems ?? 200));
  const maxPages = Math.max(1, Math.min(5, options?.maxPages ?? 2));

  for (const basePath of candidatePaths) {
    const collected: AppleMusicTrackIdentity[] = [];
    const seen = new Set<string>();
    let path = basePath;
    try {
      for (let page = 0; page < maxPages && collected.length < maxItems; page += 1) {
        const response = await fetchAppleMusicJson(path, music);
        const data = Array.isArray(response?.data) ? response.data : [];
        for (const entry of data) {
          const track = extractTrackIdentityFromResource(entry);
          if (!track) {
            continue;
          }
          const key = buildTrackHistoryKey(track);
          if (!key || seen.has(key)) {
            continue;
          }
          seen.add(key);
          collected.push(track);
          if (collected.length >= maxItems) {
            break;
          }
        }

        if (!response?.next || collected.length >= maxItems) {
          break;
        }
        path = response.next;
      }
    } catch {
      continue;
    }

    if (collected.length > 0) {
      return collected;
    }
  }

  return [];
}

async function fetchRecentPlayedTrackRanks(
  music: MusicKitInstance
): Promise<{ ranks: Map<string, number>; sampleSize: number }> {
  const tracks = await fetchTrackFeedFromCandidatePaths(
    [
      "/v1/me/recent/played/tracks?limit=100",
      "/v1/me/recent/played?limit=100",
    ],
    music,
    { maxItems: 250, maxPages: 3 }
  );
  return {
    ranks: buildTrackRankMap(tracks),
    sampleSize: tracks.length,
  };
}

async function fetchHeavyRotationTrackRanks(
  music: MusicKitInstance
): Promise<{ ranks: Map<string, number>; sampleSize: number }> {
  const tracks = await fetchTrackFeedFromCandidatePaths(
    [
      "/v1/me/history/heavy-rotation/tracks?limit=100",
      "/v1/me/history/heavy-rotation?limit=100",
      "/v1/me/history-heavy-rotation/tracks?limit=100",
      "/v1/me/history-heavy-rotation?limit=100",
    ],
    music,
    { maxItems: 200, maxPages: 2 }
  );
  return {
    ranks: buildTrackRankMap(tracks),
    sampleSize: tracks.length,
  };
}

function clearAccountHistorySnapshotCache(): void {
  accountHistorySnapshotCache = null;
  accountHistorySnapshotPromise = null;
}

async function loadAppleMusicAccountHistorySnapshot(): Promise<AppleMusicAccountHistorySnapshot | null> {
  const now = Date.now();
  if (accountHistorySnapshotCache && accountHistorySnapshotCache.expiresAtMs > now) {
    return accountHistorySnapshotCache;
  }

  if (accountHistorySnapshotPromise) {
    return accountHistorySnapshotPromise;
  }

  accountHistorySnapshotPromise = (async () => {
    try {
      const music = await initMusicKit();
      const [recentPlayed, heavyRotation] = await Promise.all([
        fetchRecentPlayedTrackRanks(music),
        fetchHeavyRotationTrackRanks(music),
      ]);

      const snapshot: AppleMusicAccountHistorySnapshot = {
        recentPlayedRanks: recentPlayed.ranks,
        heavyRotationRanks: heavyRotation.ranks,
        recentPlayedSampleSize: recentPlayed.sampleSize,
        heavyRotationSampleSize: heavyRotation.sampleSize,
        expiresAtMs: Date.now() + ACCOUNT_HISTORY_SNAPSHOT_TTL_MS,
      };
      accountHistorySnapshotCache = snapshot;
      return snapshot;
    } catch {
      return null;
    } finally {
      accountHistorySnapshotPromise = null;
    }
  })();

  return accountHistorySnapshotPromise;
}

export async function prefetchAppleMusicTrackHistorySignals(
  tracks: AppleMusicTrackIdentity[]
): Promise<void> {
  const snapshot = await loadAppleMusicAccountHistorySnapshot();
  if (!snapshot) {
    return;
  }

  for (const track of tracks) {
    const key = buildTrackHistoryKey(track);
    if (!key) {
      continue;
    }
    snapshot.recentPlayedRanks.get(key);
    snapshot.heavyRotationRanks.get(key);
  }
}

export async function fetchAppleMusicTrackHistorySignal(
  track: AppleMusicTrackIdentity
): Promise<AppleMusicTrackHistorySignal | null> {
  const key = buildTrackHistoryKey(track);
  if (!key) {
    return null;
  }

  const snapshot = await loadAppleMusicAccountHistorySnapshot();
  if (!snapshot) {
    return null;
  }

  const recentPlayedRank = snapshot.recentPlayedRanks.get(key) ?? null;
  const heavyRotationRank = snapshot.heavyRotationRanks.get(key) ?? null;
  const inRecentPlayed = recentPlayedRank !== null;
  const inHeavyRotation = heavyRotationRank !== null;

  if (!inRecentPlayed && !inHeavyRotation) {
    return null;
  }

  return {
    recentPlayedRank,
    recentPlayedSampleSize: snapshot.recentPlayedSampleSize,
    heavyRotationRank,
    heavyRotationSampleSize: snapshot.heavyRotationSampleSize,
    inRecentPlayed,
    inHeavyRotation,
  };
}

function getMusicUserToken(instance: MusicKitInstance): string {
  const token = instance.musicUserToken;
  if (!token) {
    throw new Error("Missing Music User Token. Please reconnect Apple Music.");
  }
  return token;
}

async function fetchAppleMusicJson(path: string, music: MusicKitInstance): Promise<{
  data?: unknown[];
  next?: string;
  meta?: {
    total?: number;
  };
}> {
  const developerToken = getDeveloperToken();
  const userToken = getMusicUserToken(music);
  const url = path.startsWith("http") ? path : `https://api.music.apple.com${path}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${developerToken}`,
      "Music-User-Token": userToken,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Apple Music request failed (${response.status})`);
  }

  const json = (await response.json()) as {
    data?: unknown[];
    next?: string;
    meta?: {
      total?: number;
    };
  };
  return json;
}

async function fetchLibraryPlaylistTrackCount(
  playlistId: string,
  music: MusicKitInstance
): Promise<number | null> {
  try {
    const response = await fetchAppleMusicJson(
      `/v1/me/library/playlists/${playlistId}/tracks?limit=1`,
      music
    );

    if (typeof response.meta?.total === "number") {
      return response.meta.total;
    }

    if (!response.next && Array.isArray(response.data)) {
      return response.data.length;
    }

    return null;
  } catch {
    return null;
  }
}

export async function fetchAppleMusicLibraryPlaylists(): Promise<AppleMusicPlaylist[]> {
  const music = await initMusicKit();

  const playlists: AppleMusicPlaylist[] = [];
  let path = "/v1/me/library/playlists?limit=100";

  for (let page = 0; page < 5; page += 1) {
    const response = await fetchAppleMusicJson(path, music);
    const data = Array.isArray(response?.data) ? response.data : [];

    for (const item of data) {
      const entry = item as {
        id?: string;
        attributes?: {
          name?: string;
          trackCount?: number;
        };
      };

      const id = entry.id;
      const name = entry.attributes?.name;
      if (!id || !name) {
        continue;
      }

      playlists.push({
        id,
        name,
        songCount:
          typeof entry.attributes?.trackCount === "number"
            ? entry.attributes.trackCount
            : null,
      });
    }

    if (!response?.next) {
      break;
    }

    path = response.next;
  }

  const enriched = await Promise.all(
    playlists.map(async (playlist) => {
      if (typeof playlist.songCount === "number") {
        return playlist;
      }

      const count = await fetchLibraryPlaylistTrackCount(playlist.id, music);
      return {
        ...playlist,
        songCount: count,
      };
    })
  );

  return enriched;
}

export async function fetchAppleMusicRecentTrack(): Promise<AppleMusicRecentTrack | null> {
  const music = await initMusicKit();

  const candidatePaths = [
    "/v1/me/recent/played/tracks?limit=1",
    "/v1/me/recent/played?limit=1",
    "/v1/me/library/recently-added?limit=1",
  ];

  for (const path of candidatePaths) {
    try {
      const response = await fetchAppleMusicJson(path, music);
      const first = Array.isArray(response?.data) ? response.data[0] : null;
      if (!first) {
        continue;
      }

      const track = first as {
        id?: string;
        attributes?: {
          name?: string;
          artistName?: string;
          artwork?: {
            url?: string;
          };
        };
      };

      if (!track.id || !track.attributes?.name || !track.attributes.artistName) {
        continue;
      }

      return {
        id: track.id,
        title: track.attributes.name,
        artistName: track.attributes.artistName,
        artworkUrl: buildArtworkUrl(track.attributes.artwork?.url),
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function fetchLibraryPlaylistTrackIds(
  playlistId: string,
  music: MusicKitInstance
): Promise<string[]> {
  const queueIds: string[] = [];
  const seenQueueIds = new Set<string>();
  let path = `/v1/me/library/playlists/${playlistId}/tracks?limit=100&include=catalog`;

  for (let page = 0; page < 6; page += 1) {
    const response = await fetchAppleMusicJson(path, music);
    const data = Array.isArray(response?.data) ? response.data : [];

    for (const item of data) {
      const parsed = extractPlayableTrackCandidate(item);
      if (!parsed || parsed.isLikelyLibraryOnlyId) {
        continue;
      }
      if (!seenQueueIds.has(parsed.id)) {
        seenQueueIds.add(parsed.id);
        queueIds.push(parsed.id);
      }
    }

    if (!response?.next) {
      break;
    }
    path = response.next;
  }

  return queueIds;
}

export async function fetchAppleMusicLibraryPlaylistTracks(
  playlistId: string,
  options?: { limit?: number }
): Promise<AppleMusicPlaylistTrackRef[]> {
  const music = await initMusicKit();
  const limit = Math.max(1, Math.min(120, options?.limit ?? 60));
  const tracks: AppleMusicPlaylistTrackRef[] = [];
  const seen = new Set<string>();
  let path = `/v1/me/library/playlists/${playlistId}/tracks?limit=100`;

  for (let page = 0; page < 8 && tracks.length < limit; page += 1) {
    const response = await fetchAppleMusicJson(path, music);
    const data = Array.isArray(response?.data) ? response.data : [];

    for (const item of data) {
      const track = item as {
        id?: string;
        attributes?: {
          name?: string;
          artistName?: string;
          genreNames?: string[];
          albumName?: string;
        };
      };
      const id = track.id;
      const title = track.attributes?.name?.trim();
      const artistName = track.attributes?.artistName?.trim();
      const genreTag = Array.isArray(track.attributes?.genreNames)
        ? (track.attributes.genreNames.find((entry) => typeof entry === "string" && entry.trim().length > 0) ??
          null)
        : null;
      const albumTitle =
        typeof track.attributes?.albumName === "string" && track.attributes.albumName.trim().length > 0
          ? track.attributes.albumName.trim()
          : null;
      if (!id || !title || !artistName) {
        continue;
      }
      if (
        isSoundtrackOrScoreLike({
          title,
          artistName,
          albumTitle,
          genreTag,
        })
      ) {
        continue;
      }
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      tracks.push({ id, title, artistName, genreTag, albumId: null, albumTitle });
      if (tracks.length >= limit) {
        break;
      }
    }

    if (!response?.next || tracks.length >= limit) {
      break;
    }
    path = response.next;
  }

  return tracks;
}

type ParsedPlayableTrackCandidate = {
  id: string;
  title: string;
  artistName: string;
  primaryGenre: string | null;
  albumId: string | null;
  albumTitle: string | null;
  hasCatalogId: boolean;
  isLikelyLibraryOnlyId: boolean;
};

function extractPlayableTrackCandidate(resource: unknown): ParsedPlayableTrackCandidate | null {
  if (!resource || typeof resource !== "object") {
    return null;
  }

  const track = resource as {
    id?: string;
    attributes?: {
      name?: string;
      title?: string;
      artistName?: string;
      genreNames?: string[];
      albumName?: string;
      albumTitle?: string;
      playParams?: {
        id?: string;
        catalogId?: string;
        albumId?: string;
        kind?: string;
      };
    };
    relationships?: {
      catalog?: {
        data?: Array<{ id?: string }>;
      };
      albums?: {
        data?: Array<{
          id?: string;
          attributes?: {
            name?: string;
          };
        }>;
      };
    };
    name?: string;
    title?: string;
    artistName?: string;
  };

  const title =
    track.attributes?.name ??
    track.attributes?.title ??
    track.name ??
    track.title;
  const artistName = track.attributes?.artistName ?? track.artistName;
  if (typeof title !== "string" || typeof artistName !== "string") {
    return null;
  }

  const cleanTitle = title.trim();
  const cleanArtistName = artistName.trim();
  if (!cleanTitle || !cleanArtistName) {
    return null;
  }
  const primaryGenre = Array.isArray(track.attributes?.genreNames)
    ? (track.attributes?.genreNames.find((entry) => typeof entry === "string" && entry.trim().length > 0) ??
      null)
    : null;
  const rawAlbumId =
    track.attributes?.playParams?.albumId ??
    track.relationships?.albums?.data?.[0]?.id ??
    null;
  const albumId =
    typeof rawAlbumId === "string" && rawAlbumId.trim().length > 0
      ? rawAlbumId.trim()
      : null;
  const rawAlbumTitle =
    track.attributes?.albumName ??
    track.attributes?.albumTitle ??
    track.relationships?.albums?.data?.[0]?.attributes?.name ??
    null;
  const albumTitle =
    typeof rawAlbumTitle === "string" && rawAlbumTitle.trim().length > 0
      ? rawAlbumTitle.trim()
      : null;

  if (
    isSoundtrackOrScoreLike({
      title: cleanTitle,
      artistName: cleanArtistName,
      albumTitle,
      genreTag: primaryGenre,
    })
  ) {
    return null;
  }

  const playParams = track.attributes?.playParams;
  const kind = (playParams?.kind ?? "").toLowerCase();
  const catalogId = playParams?.catalogId ?? track.relationships?.catalog?.data?.[0]?.id;
  const fallbackId = playParams?.id ?? track.id;
  const resolvedId = catalogId ?? fallbackId;
  if (!resolvedId) {
    return null;
  }

  const hasCatalogId = Boolean(catalogId);
  const isLikelyLibraryOnlyId =
    !hasCatalogId &&
    (kind.includes("library") ||
      resolvedId.startsWith("i.") ||
      resolvedId.startsWith("l."));

  return {
    id: resolvedId,
    title: cleanTitle,
    artistName: cleanArtistName,
    primaryGenre,
    albumId,
    albumTitle,
    hasCatalogId,
    isLikelyLibraryOnlyId,
  };
}

function dedupeTrackRefs(
  tracks: AppleMusicPlaylistTrackRef[],
  options?: { excludeKeys?: Set<string>; excludeIds?: Set<string> }
): AppleMusicPlaylistTrackRef[] {
  const deduped: AppleMusicPlaylistTrackRef[] = [];
  const seenIds = new Set<string>(options?.excludeIds ?? []);
  const seenKeys = new Set<string>(options?.excludeKeys ?? []);

  for (const track of tracks) {
    if (!track.id) {
      continue;
    }
    if (
      isSoundtrackOrScoreLike({
        title: track.title,
        artistName: track.artistName,
        albumTitle: track.albumTitle,
        genreTag: track.genreTag,
      })
    ) {
      continue;
    }
    const key = buildTrackHistoryKey(track);
    if (!key) {
      continue;
    }
    if (seenIds.has(track.id) || seenKeys.has(key)) {
      continue;
    }
    seenIds.add(track.id);
    seenKeys.add(key);
    deduped.push(track);
  }

  return deduped;
}

function buildLibraryTrackIndexes(libraryTracks: AppleMusicPlaylistTrackRef[]): {
  byId: Map<string, AppleMusicPlaylistTrackRef>;
  byKey: Map<string, AppleMusicPlaylistTrackRef>;
} {
  const byId = new Map<string, AppleMusicPlaylistTrackRef>();
  const byKey = new Map<string, AppleMusicPlaylistTrackRef>();
  for (const track of libraryTracks) {
    if (!track.id) {
      continue;
    }
    byId.set(track.id, track);
    const key = buildTrackHistoryKey(track);
    if (key) {
      byKey.set(key, track);
    }
  }
  return { byId, byKey };
}

function mapCandidateRefsToLibraryTracks(
  candidates: AppleMusicPlaylistTrackRef[],
  libraryIndex: {
    byId: Map<string, AppleMusicPlaylistTrackRef>;
    byKey: Map<string, AppleMusicPlaylistTrackRef>;
  },
  limit = 120
): AppleMusicPlaylistTrackRef[] {
  const mapped: AppleMusicPlaylistTrackRef[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (mapped.length >= limit) {
      break;
    }
    const byId = libraryIndex.byId.get(candidate.id);
    const key = buildTrackHistoryKey(candidate);
    const byKey = key ? libraryIndex.byKey.get(key) : null;
    const resolved = byId ?? byKey ?? null;
    if (!resolved) {
      continue;
    }
    if (seen.has(resolved.id)) {
      continue;
    }
    seen.add(resolved.id);
    mapped.push(resolved);
  }
  return mapped;
}

function toTuneInTrackRef(
  track: AppleMusicPlaylistTrackRef,
  source: TuneInTrackSource
): AppleMusicTuneInTrackRef {
  return {
    id: track.id,
    title: track.title,
    artistName: track.artistName,
    source,
    genreTag: track.genreTag ?? null,
    albumId: track.albumId ?? null,
    albumTitle: track.albumTitle ?? null,
  };
}

function toOpeningTrackCandidate(
  track: AppleMusicPlaylistTrackRef | AppleMusicTuneInTrackRef,
  source: TuneInTrackSource
): TuneInOpeningTrackCandidate {
  return {
    id: track.id,
    title: track.title,
    artistName: track.artistName,
    source,
  };
}

async function fetchHeavyRotationTrackRefs(
  music: MusicKitInstance,
  options?: { includeHistory?: boolean }
): Promise<AppleMusicPlaylistTrackRef[]> {
  const playlistTrackRefs: AppleMusicPlaylistTrackRef[] = [];
  const heavyRotationPlaylistIds: string[] = [];
  let playlistPath = "/v1/me/library/playlists?limit=100";

  for (let page = 0; page < 4; page += 1) {
    let response: {
      data?: unknown[];
      next?: string;
    };
    try {
      response = await fetchAppleMusicJson(playlistPath, music);
    } catch {
      break;
    }

    const playlists = Array.isArray(response?.data) ? response.data : [];
    for (const playlist of playlists) {
      if (!playlist || typeof playlist !== "object") {
        continue;
      }
      const parsed = playlist as {
        id?: unknown;
        attributes?: {
          name?: unknown;
        };
      };
      const name =
        typeof parsed.attributes?.name === "string"
          ? parsed.attributes.name.trim().toLowerCase()
          : "";
      const id = typeof parsed.id === "string" ? parsed.id.trim() : "";
      if (!id || !name) {
        continue;
      }
      if (name === "heavy rotation" || name.includes("heavy rotation")) {
        heavyRotationPlaylistIds.push(id);
      }
    }

    if (!response?.next) {
      break;
    }
    playlistPath = response.next;
  }

  for (const playlistId of heavyRotationPlaylistIds) {
    const refs = await fetchTrackRefsFromCandidatePaths(
      [`/v1/me/library/playlists/${playlistId}/tracks?limit=100&include=catalog`],
      music,
      {
        maxItems: 140,
        maxPages: 3,
        skipLikelyLibraryOnlyIds: false,
      }
    );
    if (refs.length > 0) {
      playlistTrackRefs.push(...refs);
    }
  }

  if (options?.includeHistory === false) {
    return dedupeTrackRefs(playlistTrackRefs);
  }

  const historyTrackRefs = await fetchTrackRefsFromCandidatePaths(
    [
      "/v1/me/history/heavy-rotation/tracks?limit=100",
      "/v1/me/history/heavy-rotation?limit=100",
      "/v1/me/history-heavy-rotation/tracks?limit=100",
      "/v1/me/history-heavy-rotation?limit=100",
    ],
    music,
    {
      maxItems: 120,
      maxPages: 3,
      skipLikelyLibraryOnlyIds: true,
    }
  );

  return dedupeTrackRefs([...playlistTrackRefs, ...historyTrackRefs]);
}

export async function fetchAppleMusicHeavyRotationTracks(options?: {
  limit?: number;
}): Promise<AppleMusicPlaylistTrackRef[]> {
  const music = await initMusicKit();
  const refs = await fetchHeavyRotationTrackRefs(music, { includeHistory: false });
  const limit = Math.max(10, Math.min(500, options?.limit ?? 180));
  return refs.slice(0, limit);
}

async function fetchRecentlyPlayedTrackRefs(
  music: MusicKitInstance
): Promise<AppleMusicPlaylistTrackRef[]> {
  return dedupeTrackRefs(
    await fetchTrackRefsFromCandidatePaths(
      [
        "/v1/me/recent/played/tracks?limit=100",
        "/v1/me/recent/played?limit=100",
      ],
      music,
      {
        maxItems: 120,
        maxPages: 3,
        skipLikelyLibraryOnlyIds: true,
      }
    )
  );
}

async function fetchFavoriteLibraryTrackRefs(
  music: MusicKitInstance
): Promise<AppleMusicPlaylistTrackRef[]> {
  const candidates = await fetchTrackRefsFromCandidatePaths(
    [
      "/v1/me/library/songs?filter[favorited]=true&limit=100&include=catalog",
      "/v1/me/library/songs?filter[favorite]=true&limit=100&include=catalog",
    ],
    music,
    {
      maxItems: 140,
      maxPages: 2,
      skipLikelyLibraryOnlyIds: false,
    }
  );
  return dedupeTrackRefs(candidates);
}

export async function fetchAppleMusicFavoritedSongs(options?: {
  limit?: number;
}): Promise<AppleMusicPlaylistTrackRef[]> {
  const music = await initMusicKit();
  const refs = await fetchFavoriteLibraryTrackRefs(music);
  const limit = Math.max(10, Math.min(500, options?.limit ?? 180));
  return refs.slice(0, limit);
}

function buildMostPlayedLibraryTrackRefs(
  libraryIndex: {
    byId: Map<string, AppleMusicPlaylistTrackRef>;
    byKey: Map<string, AppleMusicPlaylistTrackRef>;
  },
  options?: { sinceDays?: number; limit?: number }
): AppleMusicPlaylistTrackRef[] {
  const sinceDays = Math.max(30, Math.min(90, options?.sinceDays ?? 90));
  const limit = Math.max(20, Math.min(160, options?.limit ?? 120));
  const events = getPlaybackHistoryEvents({
    sinceDays,
    maxEvents: 2200,
  }).filter((event) => event.source === "library");

  const aggregate = new Map<
    string,
    { count: number; lastPlayedAt: number; trackId: string | null; trackKey: string }
  >();
  for (const event of events) {
    const key = event.trackId?.trim() || event.trackKey;
    if (!key) {
      continue;
    }
    const current = aggregate.get(key) ?? {
      count: 0,
      lastPlayedAt: 0,
      trackId: event.trackId ?? null,
      trackKey: event.trackKey,
    };
    current.count += 1;
    const ts = new Date(event.playedAt).getTime();
    if (Number.isFinite(ts)) {
      current.lastPlayedAt = Math.max(current.lastPlayedAt, ts);
    }
    aggregate.set(key, current);
  }

  const ranked = [...aggregate.values()].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return b.lastPlayedAt - a.lastPlayedAt;
  });

  const resolved: AppleMusicPlaylistTrackRef[] = [];
  const seen = new Set<string>();
  for (const row of ranked) {
    if (resolved.length >= limit) {
      break;
    }
    const byId =
      row.trackId && row.trackId.trim().length > 0
        ? libraryIndex.byId.get(row.trackId.trim()) ?? null
        : null;
    const byKey = libraryIndex.byKey.get(row.trackKey) ?? null;
    const track = byId ?? byKey;
    if (!track || seen.has(track.id)) {
      continue;
    }
    seen.add(track.id);
    resolved.push(track);
  }
  return resolved;
}

function buildOpeningTrackMetadataIndex(
  tracks: AppleMusicTuneInTrackRef[]
): {
  byId: Map<string, AppleMusicTuneInTrackRef>;
  byKey: Map<string, AppleMusicTuneInTrackRef>;
} {
  const byId = new Map<string, AppleMusicTuneInTrackRef>();
  const byKey = new Map<string, AppleMusicTuneInTrackRef>();
  for (const track of tracks) {
    if (!byId.has(track.id)) {
      byId.set(track.id, track);
    }
    const key = buildTrackHistoryKey(track);
    if (key && !byKey.has(key)) {
      byKey.set(key, track);
    }
  }
  return { byId, byKey };
}

function coerceOpeningCandidateToTuneInTrack(
  candidate: TuneInOpeningTrackCandidate,
  mixedTrackIndex: {
    byId: Map<string, AppleMusicTuneInTrackRef>;
    byKey: Map<string, AppleMusicTuneInTrackRef>;
  },
  libraryTrackIndex: {
    byId: Map<string, AppleMusicPlaylistTrackRef>;
    byKey: Map<string, AppleMusicPlaylistTrackRef>;
  }
): AppleMusicTuneInTrackRef {
  const byId = mixedTrackIndex.byId.get(candidate.id) ?? null;
  if (byId) {
    return {
      ...byId,
      source: candidate.source,
    };
  }

  const key = buildTrackHistoryKey(candidate);
  if (key) {
    const byKey = mixedTrackIndex.byKey.get(key) ?? null;
    if (byKey) {
      return {
        ...byKey,
        source: candidate.source,
      };
    }
  }

  const libraryById = libraryTrackIndex.byId.get(candidate.id) ?? null;
  if (libraryById) {
    return toTuneInTrackRef(libraryById, "library");
  }

  if (key) {
    const libraryByKey = libraryTrackIndex.byKey.get(key) ?? null;
    if (libraryByKey) {
      return toTuneInTrackRef(libraryByKey, "library");
    }
  }

  return {
    id: candidate.id,
    title: candidate.title,
    artistName: candidate.artistName,
    source: candidate.source,
    genreTag: null,
    albumId: null,
    albumTitle: null,
  };
}

function readTuneInHistoryEntriesForSelection(): TuneInHistoryEntry[] {
  return getPlaybackHistoryEvents({ mode: "tune-in", maxEvents: 1800 }).map((entry) => ({
    trackKey: buildTrackHistoryKey({
      title: entry.title,
      artistName: entry.artistName,
    }),
    trackId: entry.trackId,
    artistKey: entry.artistKey,
    genreKey: entry.genreKey,
    playedAt: entry.playedAt,
  }));
}

function readRecentTuneInSessionFirstTrackSignals(limit = 12): {
  ids: string[];
  keys: string[];
  previousId: string | null;
  previousKey: string | null;
} {
  const maxEvents = Math.max(200, limit * 60);
  const events = getPlaybackHistoryEvents({
    mode: "tune-in",
    maxEvents,
  });
  if (events.length === 0) {
    return {
      ids: [],
      keys: [],
      previousId: null,
      previousKey: null,
    };
  }

  const firstBySession = new Map<
    string,
    {
      trackId: string;
      trackKey: string;
      playedAtMs: number;
    }
  >();
  for (const event of events) {
    const sessionId = event.sessionId?.trim();
    const trackId = event.trackId?.trim();
    const trackKey = buildTrackHistoryKey({
      title: event.title,
      artistName: event.artistName,
    });
    if (!sessionId || !trackId || !trackKey) {
      continue;
    }
    if (firstBySession.has(sessionId)) {
      continue;
    }
    const playedAtMs = new Date(event.playedAt).getTime();
    firstBySession.set(sessionId, {
      trackId,
      trackKey,
      playedAtMs: Number.isFinite(playedAtMs) ? playedAtMs : 0,
    });
  }

  const ordered = [...firstBySession.values()]
    .sort((a, b) => a.playedAtMs - b.playedAtMs)
    .slice(-Math.max(1, limit));

  const ids = ordered.map((entry) => entry.trackId);
  const keys = ordered.map((entry) => entry.trackKey);
  return {
    ids,
    keys,
    previousId: ids.length > 0 ? ids[ids.length - 1] : null,
    previousKey: keys.length > 0 ? keys[keys.length - 1] : null,
  };
}

async function fetchLibrarySongPool(
  music: MusicKitInstance,
  options?: { limit?: number }
): Promise<AppleMusicPlaylistTrackRef[]> {
  const limit = Math.max(30, Math.min(400, options?.limit ?? 240));
  const collected: AppleMusicPlaylistTrackRef[] = [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  let path = "/v1/me/library/songs?limit=100&include=catalog";

  for (let page = 0; page < 10 && collected.length < limit; page += 1) {
    let response: {
      data?: unknown[];
      next?: string;
    };
    try {
      response = await fetchAppleMusicJson(path, music);
    } catch {
      break;
    }

    const data = Array.isArray(response?.data) ? response.data : [];
    for (const item of data) {
      const parsed = extractPlayableTrackCandidate(item);
      if (!parsed) {
        continue;
      }
      if (parsed.isLikelyLibraryOnlyId) {
        continue;
      }
      const key = buildTrackHistoryKey(parsed);
      if (!key || seenKeys.has(key) || seenIds.has(parsed.id)) {
        continue;
      }
      seenKeys.add(key);
      seenIds.add(parsed.id);
      collected.push({
        id: parsed.id,
        title: parsed.title,
        artistName: parsed.artistName,
        genreTag: parsed.primaryGenre,
        albumId: parsed.albumId,
        albumTitle: parsed.albumTitle,
      });
      if (collected.length >= limit) {
        break;
      }
    }

    if (!response?.next || collected.length >= limit) {
      break;
    }
    path = response.next;
  }

  if (collected.length >= limit) {
    return collected;
  }

  const recentAdded = await fetchTrackRefsFromCandidatePaths(
    ["/v1/me/library/recently-added?limit=100"],
    music,
    { maxItems: Math.max(40, limit - collected.length), maxPages: 3, skipLikelyLibraryOnlyIds: true }
  );
  const merged = dedupeTrackRefs([...collected, ...recentAdded]);
  return merged.slice(0, limit);
}

export async function fetchAppleMusicLibrarySongs(options?: {
  limit?: number;
}): Promise<AppleMusicPlaylistTrackRef[]> {
  const music = await initMusicKit();
  return await fetchLibrarySongPool(music, {
    limit: options?.limit ?? 240,
  });
}

async function fetchTrackRefsFromCandidatePaths(
  candidatePaths: string[],
  music: MusicKitInstance,
  options?: {
    maxItems?: number;
    maxPages?: number;
    skipLikelyLibraryOnlyIds?: boolean;
    excludeKeys?: Set<string>;
    excludeIds?: Set<string>;
  }
): Promise<AppleMusicPlaylistTrackRef[]> {
  const maxItems = Math.max(10, Math.min(500, options?.maxItems ?? 160));
  const maxPages = Math.max(1, Math.min(8, options?.maxPages ?? 3));
  const collected: AppleMusicPlaylistTrackRef[] = [];
  const seenIds = new Set<string>(options?.excludeIds ?? []);
  const seenKeys = new Set<string>(options?.excludeKeys ?? []);

  for (const basePath of candidatePaths) {
    let path = basePath;
    for (let page = 0; page < maxPages && collected.length < maxItems; page += 1) {
      let response: {
        data?: unknown[];
        next?: string;
      };
      try {
        response = await fetchAppleMusicJson(path, music);
      } catch {
        break;
      }

      const data = Array.isArray(response?.data) ? response.data : [];
      for (const item of data) {
        const parsed = extractPlayableTrackCandidate(item);
        if (!parsed) {
          continue;
        }
        if (options?.skipLikelyLibraryOnlyIds && parsed.isLikelyLibraryOnlyId) {
          continue;
        }
        const key = buildTrackHistoryKey(parsed);
        if (!key || seenKeys.has(key) || seenIds.has(parsed.id)) {
          continue;
        }
        seenKeys.add(key);
        seenIds.add(parsed.id);
        collected.push({
          id: parsed.id,
          title: parsed.title,
          artistName: parsed.artistName,
          genreTag: parsed.primaryGenre,
          albumId: parsed.albumId,
          albumTitle: parsed.albumTitle,
        });
        if (collected.length >= maxItems) {
          break;
        }
      }

      if (!response?.next || collected.length >= maxItems) {
        break;
      }
      path = response.next;
    }
    if (collected.length >= maxItems) {
      break;
    }
  }

  return collected.slice(0, maxItems);
}

async function fetchMusicStorefrontId(music: MusicKitInstance): Promise<string> {
  try {
    const response = await fetchAppleMusicJson("/v1/me/storefront", music);
    const first = Array.isArray(response?.data) ? response.data[0] : null;
    if (
      first &&
      typeof first === "object" &&
      "id" in first &&
      typeof (first as { id?: unknown }).id === "string"
    ) {
      return (first as { id: string }).id;
    }
  } catch {
    // Fallback below.
  }
  return "us";
}

function isLikelyLibraryOnlyTrackId(id: string): boolean {
  return id.startsWith("i.") || id.startsWith("l.");
}

function readCachedTrackAvailability(id: string): boolean | null {
  const cached = availabilityCache.get(id);
  if (!cached) {
    return null;
  }
  if (cached.expiresAtMs <= Date.now()) {
    availabilityCache.delete(id);
    return null;
  }
  return cached.playable;
}

function cacheTrackAvailability(id: string, playable: boolean): void {
  availabilityCache.set(id, {
    playable,
    expiresAtMs: Date.now() + TRACK_AVAILABILITY_CACHE_TTL_MS,
  });
}

type TrackAvailabilityResolution = {
  playableTrackIds: string[];
  unavailableTrackIds: string[];
  verifiedLeadingPlayableCount: number;
  verifiedLeadingWindowSize: number;
};

async function resolvePlayableTrackIds(
  trackIds: string[],
  music: MusicKitInstance,
  options?: {
    strict?: boolean;
    validateLeadingCount?: number;
    contextLabel?: string;
  }
): Promise<TrackAvailabilityResolution> {
  const strict = options?.strict ?? false;
  const validateLeadingCount = Math.max(3, Math.min(8, options?.validateLeadingCount ?? 5));
  const uniqueTrackIds = Array.from(
    new Set(trackIds.filter((id) => typeof id === "string" && id.trim().length > 0))
  );
  if (uniqueTrackIds.length === 0) {
    return {
      playableTrackIds: [],
      unavailableTrackIds: [],
      verifiedLeadingPlayableCount: 0,
      verifiedLeadingWindowSize: validateLeadingCount,
    };
  }

  const catalogTrackIds = uniqueTrackIds.filter((id) => !isLikelyLibraryOnlyTrackId(id));
  const playableCatalogIds = new Set<string>();
  const unavailableCatalogIds = new Set<string>();
  const unresolvedCatalogIds: string[] = [];

  for (const id of catalogTrackIds) {
    const cached = readCachedTrackAvailability(id);
    if (cached === null) {
      unresolvedCatalogIds.push(id);
      continue;
    }
    if (cached) {
      playableCatalogIds.add(id);
    } else {
      unavailableCatalogIds.add(id);
    }
  }

  if (unresolvedCatalogIds.length > 0) {
    const storefrontId = await fetchMusicStorefrontId(music);
    for (let start = 0; start < unresolvedCatalogIds.length; start += TRACK_AVAILABILITY_BATCH_SIZE) {
      const batch = unresolvedCatalogIds.slice(start, start + TRACK_AVAILABILITY_BATCH_SIZE);
      if (batch.length === 0) {
        continue;
      }

      try {
        const response = await fetchAppleMusicJson(
          `/v1/catalog/${storefrontId}/songs?ids=${encodeURIComponent(batch.join(","))}`,
          music
        );
        const data = Array.isArray(response?.data) ? response.data : [];
        const returnedIds = new Set<string>();

        for (const item of data) {
          const parsed = extractPlayableTrackCandidate(item);
          const returnedId = parsed?.id;
          if (!returnedId) {
            continue;
          }
          if (!batch.includes(returnedId)) {
            continue;
          }
          returnedIds.add(returnedId);
          playableCatalogIds.add(returnedId);
          unavailableCatalogIds.delete(returnedId);
          cacheTrackAvailability(returnedId, true);
        }

        for (const requestedId of batch) {
          if (returnedIds.has(requestedId)) {
            continue;
          }
          unavailableCatalogIds.add(requestedId);
          cacheTrackAvailability(requestedId, false);
        }
      } catch (error) {
        // Availability probe failed. Do not mark unresolved ids as playable
        // here; unresolved leading tracks are handled fail-closed below.
        console.warn(
          `[W.A.I.V.][AppleMusic] availability probe failed for ${options?.contextLabel ?? "queue"}`,
          error
        );
      }
    }
  }

  const playableTrackIds: string[] = [];
  const unavailableTrackIds: string[] = [];

  for (let index = 0; index < uniqueTrackIds.length; index += 1) {
    const id = uniqueTrackIds[index];
    if (isLikelyLibraryOnlyTrackId(id)) {
      if (strict) {
        unavailableTrackIds.push(id);
      } else {
        playableTrackIds.push(id);
      }
      continue;
    }

    if (playableCatalogIds.has(id)) {
      playableTrackIds.push(id);
      continue;
    }

    if (unavailableCatalogIds.has(id)) {
      unavailableTrackIds.push(id);
      continue;
    }

    // Fail closed for unresolved leading tracks so queue startup does not
    // depend on unknown availability.
    const withinLeadingWindow = index < validateLeadingCount;
    if (strict || withinLeadingWindow) {
      unavailableTrackIds.push(id);
    } else {
      playableTrackIds.push(id);
    }
  }

  const leadingSlice = playableTrackIds.slice(0, validateLeadingCount);
  const verifiedLeadingPlayableCount = leadingSlice.filter((id) => {
    if (isLikelyLibraryOnlyTrackId(id)) {
      return false;
    }
    return playableCatalogIds.has(id);
  }).length;

  return {
    playableTrackIds,
    unavailableTrackIds,
    verifiedLeadingPlayableCount,
    verifiedLeadingWindowSize: validateLeadingCount,
  };
}

export async function prewarmAppleMusicTrackAvailability(
  trackIds: string[],
  options?: { validateLeadingCount?: number; contextLabel?: string }
): Promise<void> {
  const music = await initMusicKit();
  await resolvePlayableTrackIds(trackIds, music, {
    strict: false,
    validateLeadingCount: options?.validateLeadingCount ?? 5,
    contextLabel: options?.contextLabel ?? "background_prewarm",
  });
}

export async function filterPlayableAppleMusicTrackIds(
  trackIds: string[],
  options?: {
    strict?: boolean;
    validateLeadingCount?: number;
    contextLabel?: string;
  }
): Promise<{ playableTrackIds: string[]; unavailableTrackIds: string[] }> {
  const music = await initMusicKit();
  const resolved = await resolvePlayableTrackIds(trackIds, music, {
    strict: options?.strict ?? false,
    validateLeadingCount: options?.validateLeadingCount ?? 5,
    contextLabel: options?.contextLabel ?? "track_filter",
  });
  return {
    playableTrackIds: resolved.playableTrackIds,
    unavailableTrackIds: resolved.unavailableTrackIds,
  };
}

function topArtistSeeds(tracks: AppleMusicPlaylistTrackRef[], maxArtists = 8): string[] {
  const counts = new Map<string, number>();
  for (const track of tracks) {
    const artist = track.artistName.trim();
    if (!artist) {
      continue;
    }
    counts.set(artist, (counts.get(artist) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxArtists)
    .map(([artist]) => artist);
}

async function fetchCatalogSuggestionsFromLibraryArtists(
  music: MusicKitInstance,
  libraryTracks: AppleMusicPlaylistTrackRef[],
  options?: {
    limit?: number;
    excludeKeys?: Set<string>;
    excludeIds?: Set<string>;
    maxArtists?: number;
    searchLimitPerArtist?: number;
  }
): Promise<AppleMusicPlaylistTrackRef[]> {
  const target = Math.max(12, Math.min(260, options?.limit ?? 48));
  const artistSeeds = topArtistSeeds(
    libraryTracks,
    Math.max(8, Math.min(28, options?.maxArtists ?? 8))
  );
  if (artistSeeds.length === 0) {
    return [];
  }
  const searchLimitPerArtist = Math.max(10, Math.min(25, options?.searchLimitPerArtist ?? 12));

  const storefrontId = await fetchMusicStorefrontId(music);
  const suggestions: AppleMusicPlaylistTrackRef[] = [];
  const seenIds = new Set<string>(options?.excludeIds ?? []);
  const seenKeys = new Set<string>(options?.excludeKeys ?? []);

  for (const artist of artistSeeds) {
    if (suggestions.length >= target) {
      break;
    }

    const path = `/v1/catalog/${storefrontId}/search?types=songs&term=${encodeURIComponent(artist)}&limit=${searchLimitPerArtist}`;
    let response: {
      results?: {
        songs?: {
          data?: unknown[];
        };
      };
    };
    try {
      response = (await fetchAppleMusicJson(path, music)) as {
        results?: {
          songs?: {
            data?: unknown[];
          };
        };
      };
    } catch {
      continue;
    }

    const songs = Array.isArray(response?.results?.songs?.data)
      ? response.results.songs.data
      : [];
    for (const song of songs) {
      const parsed = extractPlayableTrackCandidate(song);
      if (!parsed) {
        continue;
      }
      const key = buildTrackHistoryKey(parsed);
      if (!key || seenKeys.has(key) || seenIds.has(parsed.id)) {
        continue;
      }
      seenKeys.add(key);
      seenIds.add(parsed.id);
      suggestions.push({
        id: parsed.id,
        title: parsed.title,
        artistName: parsed.artistName,
        genreTag: parsed.primaryGenre,
        albumId: parsed.albumId,
        albumTitle: parsed.albumTitle,
      });
      if (suggestions.length >= target) {
        break;
      }
    }
  }

  return suggestions;
}

function buildTuneInMix(
  libraryPool: AppleMusicPlaylistTrackRef[],
  suggestionPool: AppleMusicPlaylistTrackRef[],
  targetSize: number,
  historyEntries: TuneInHistoryEntry[],
  seed: string
): ReturnType<typeof buildConstrainedTuneInMix> {
  return buildConstrainedTuneInMix({
    libraryTracks: libraryPool.map((track) => ({
      id: track.id,
      title: track.title,
      artistName: track.artistName,
      source: "library",
      genreTag: track.genreTag ?? null,
      albumId: track.albumId ?? null,
      albumTitle: track.albumTitle ?? null,
    })),
    suggestionTracks: suggestionPool.map((track) => ({
      id: track.id,
      title: track.title,
      artistName: track.artistName,
      source: "suggestion",
      genreTag: track.genreTag ?? null,
      albumId: track.albumId ?? null,
      albumTitle: track.albumTitle ?? null,
    })),
    targetSize,
    historyEntries,
    seed,
  });
}

async function playAppleMusicSongsQueue(
  trackIds: string[],
  options?: {
    shuffle?: boolean;
    contextLabel?: string;
    autoPlay?: boolean;
    strictAvailability?: boolean;
    validateLeadingCount?: number;
    requiredVerifiedLeadingCount?: number;
  }
): Promise<string[]> {
  const uniqueTrackIds = Array.from(
    new Set(trackIds.filter((id) => typeof id === "string" && id.trim().length > 0))
  );
  const queueableTrackIds = uniqueTrackIds.filter((id) => !isLikelyLibraryOnlyTrackId(id));
  if (queueableTrackIds.length === 0) {
    throw new Error("No queueable catalog tracks were available.");
  }

  const music = await initMusicKit();
  const controller = music.player ?? music;
  const setQueue = typeof music.setQueue === "function" ? music.setQueue.bind(music) : null;
  const { playPrimary, playFallback } = getPlayFns(controller, music);
  const stopTransport =
    (typeof controller.stop === "function" && controller.stop.bind(controller)) ||
    (controller !== music && typeof music.stop === "function" ? music.stop.bind(music) : null);
  const skipNext = getSkipNextFn(controller);
  const isCurrentlyPlaying = () => isControllerPlaying(controller, music);
  const queueLabel = options?.contextLabel ?? "queue";

  if (!setQueue || (!playPrimary && !playFallback)) {
    throw new Error("Playback controls are unavailable in MusicKit.");
  }

  if (typeof music.shuffleMode === "number") {
    music.shuffleMode = options?.shuffle ? 1 : 0;
  }

  const availability = await resolvePlayableTrackIds(queueableTrackIds, music, {
    strict: options?.strictAvailability ?? false,
    validateLeadingCount: options?.validateLeadingCount ?? 5,
    contextLabel: queueLabel,
  });
  const queueTrackIds = availability.playableTrackIds;
  if (queueTrackIds.length === 0) {
    throw new Error("No playable tracks were available after availability checks.");
  }
  if (availability.unavailableTrackIds.length > 0) {
    console.info("[W.A.I.V.][AppleMusic] filtered unavailable queue tracks", {
      context: queueLabel,
      unavailableCount: availability.unavailableTrackIds.length,
      strictAvailability: options?.strictAvailability ?? false,
    });
  }
  const requiredVerifiedLeadingCount = Math.max(
    1,
    Math.min(
      availability.verifiedLeadingWindowSize,
      options?.requiredVerifiedLeadingCount ?? 1
    )
  );
  if (availability.verifiedLeadingPlayableCount < requiredVerifiedLeadingCount) {
    throw new Error(
      `${queueLabel} queue could not verify enough playable leading tracks.`
    );
  }
  if (availability.verifiedLeadingPlayableCount < Math.min(3, availability.verifiedLeadingWindowSize)) {
    console.warn("[W.A.I.V.][AppleMusic] limited verified leading tracks", {
      context: queueLabel,
      verifiedLeadingPlayableCount: availability.verifiedLeadingPlayableCount,
      verifiedLeadingWindowSize: availability.verifiedLeadingWindowSize,
      requiredVerifiedLeadingCount,
    });
  }

  const deadlineAt = Date.now() + 28000;
  let lastStage = "queue_songs";
  let lastProbeStart = -1;
  let lastError: unknown = null;

  if (options?.autoPlay === false && stopTransport) {
    try {
      await withTimeout(
        stopTransport(),
        2200,
        `Timed out while resetting ${queueLabel} transport before queue.`
      );
    } catch {
      // Best effort only; setQueue call below is still authoritative.
    }
  }

  await withTimeout(
    setQueue({ songs: queueTrackIds }),
    7000,
    `Timed out while preparing ${queueLabel} tracks queue.`
  );

  await sleep(260);

  if (options?.autoPlay === false) {
    return queueTrackIds;
  }

  const verifyPlaying = async (polls: number): Promise<boolean> => {
    for (let verify = 0; verify < polls; verify += 1) {
      if (isCurrentlyPlaying()) {
        return true;
      }
      await sleep(160 + verify * 40);
    }
    return isCurrentlyPlaying();
  };

  const tryStartTransport = async (): Promise<void> => {
    try {
      if (playPrimary) {
        await withTimeout(playPrimary(), 4200, `Timed out while starting ${queueLabel} playback.`);
      } else if (playFallback) {
        await withTimeout(playFallback(), 4200, `Timed out while fallback starting ${queueLabel} playback.`);
      }
    } catch (error) {
      lastError = error;
      if (playFallback && playPrimary) {
        try {
          await withTimeout(playFallback(), 4200, `Timed out while fallback starting ${queueLabel} playback.`);
        } catch (fallbackError) {
          lastError = fallbackError;
        }
      }
    }
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (Date.now() > deadlineAt - 1800) {
      break;
    }
    lastStage = `play_initial_attempt_${attempt + 1}`;
    await tryStartTransport();
    if (await verifyPlaying(4)) {
      return queueTrackIds;
    }
    await sleep(120 + attempt * 80);
  }

  if (!isCurrentlyPlaying() && skipNext && Date.now() < deadlineAt - 1600) {
    let previousId = getNowPlayingIdentity(controller, music);
    for (let skipped = 0; skipped < 10; skipped += 1) {
      if (Date.now() > deadlineAt - 1300) {
        break;
      }
      try {
        lastStage = `skip_leading_${skipped + 1}`;
        await withTimeout(
          skipNext(),
          3200,
          `Timed out while skipping unavailable leading ${queueLabel} track.`
        );
      } catch (error) {
        lastError = error;
        break;
      }

      const advanced = await waitForTrackAdvance(controller, music, previousId, 12);
      previousId = getNowPlayingIdentity(controller, music);
      lastStage = `play_after_leading_skip_${skipped + 1}`;
      await tryStartTransport();
      if (await verifyPlaying(3)) {
        return queueTrackIds;
      }
      if (!advanced) {
        break;
      }
    }
  }

  if (!isCurrentlyPlaying() && Date.now() < deadlineAt - 2600) {
    for (let start = 0; start < Math.min(queueTrackIds.length, 80); start += 1) {
      if (Date.now() > deadlineAt - 1800) {
        break;
      }
      lastProbeStart = start + 1;
      const probeIds = queueTrackIds.slice(start, Math.min(queueTrackIds.length, start + 100));
      if (!probeIds.length) {
        break;
      }

      if (stopTransport) {
        try {
          await withTimeout(stopTransport(), 2200, "Timed out while resetting transport.");
        } catch {
          // Best effort only.
        }
      }

      try {
        lastStage = `probe_set_queue_start_${start + 1}`;
        await withTimeout(
          setQueue({ songs: probeIds }),
          7000,
          `Timed out while probing ${queueLabel} start from track ${start + 1}.`
        );
      } catch (error) {
        lastError = error;
        continue;
      }

      await sleep(220);
      let probePreviousId = getNowPlayingIdentity(controller, music);
      for (let localSkip = 0; localSkip < 4; localSkip += 1) {
        if (Date.now() > deadlineAt - 1200) {
          break;
        }
        lastStage = `probe_play_start_${start + 1}_skip_${localSkip}`;
        await tryStartTransport();
        if (await verifyPlaying(4)) {
          return queueTrackIds;
        }
        if (!skipNext) {
          break;
        }
        try {
          lastStage = `probe_skip_start_${start + 1}_skip_${localSkip + 1}`;
          await withTimeout(
            skipNext(),
            2800,
            "Timed out while probing next song inside start-window."
          );
        } catch (error) {
          lastError = error;
          break;
        }
        const advanced = await waitForTrackAdvance(controller, music, probePreviousId, 11);
        probePreviousId = getNowPlayingIdentity(controller, music);
        if (!advanced) {
          break;
        }
      }
    }
  }

  if (isCurrentlyPlaying()) {
    return queueTrackIds;
  }

  if (!isCurrentlyPlaying() && skipNext) {
    const recovered = await skipForwardUntilPlayable(controller, music, {
      skipFn: skipNext,
      maxSkips: 14,
      contextLabel: queueLabel,
      requireAdvance: false,
    });
    if (recovered) {
      return queueTrackIds;
    }
  }

  const detail = errorMessageFromUnknown(lastError);
  const stageInfo =
    lastProbeStart > 0
      ? ` stage=${lastStage}; probeStart=${lastProbeStart};`
      : ` stage=${lastStage};`;
  throw new Error(
    detail
      ? `${queueLabel} queued but could not start playback. Leading tracks may be unavailable.${stageInfo} ${detail}`
      : `${queueLabel} queued but could not start playback. Leading tracks may be unavailable.${stageInfo}`
  );
}

export async function buildAppleMusicTuneInSession(
  options?: { targetSize?: number; shuffle?: boolean }
): Promise<AppleMusicTuneInSession> {
  const music = await initMusicKit();
  const targetSize = Math.max(24, Math.min(120, options?.targetSize ?? 72));
  let libraryPool = await fetchLibrarySongPool(music, { limit: Math.max(120, targetSize * 2) });
  if (libraryPool.length === 0) {
    throw new Error("Could not load playable songs from your library for Tune-In.");
  }

  const libraryKeys = new Set<string>();
  const libraryIds = new Set<string>();
  const indexLibraryTracks = (tracks: AppleMusicPlaylistTrackRef[]) => {
    for (const track of tracks) {
      libraryKeys.add(buildTrackHistoryKey(track));
      libraryIds.add(track.id);
    }
  };
  indexLibraryTracks(libraryPool);

  const [heavyRotationRefs, favoriteLibraryRefsRaw, recentlyPlayedRefsRaw] =
    await Promise.all([
      fetchHeavyRotationTrackRefs(music),
      fetchFavoriteLibraryTrackRefs(music),
      fetchRecentlyPlayedTrackRefs(music),
    ]);

  const historySuggestionPool = dedupeTrackRefs(
    await fetchTrackRefsFromCandidatePaths(
      [
        "/v1/me/recent/played/tracks?limit=100",
        "/v1/me/recent/played?limit=100",
        "/v1/me/history/heavy-rotation/tracks?limit=100",
        "/v1/me/history/heavy-rotation?limit=100",
        "/v1/me/history-heavy-rotation/tracks?limit=100",
        "/v1/me/history-heavy-rotation?limit=100",
      ],
      music,
      {
        maxItems: Math.max(40, Math.round(targetSize * 0.8)),
        maxPages: 3,
        skipLikelyLibraryOnlyIds: true,
        excludeIds: libraryIds,
        excludeKeys: libraryKeys,
      }
    )
  );

  const desiredSuggestionCount = Math.max(8, Math.round(targetSize * 0.3));
  let suggestionPool = historySuggestionPool;
  if (suggestionPool.length < desiredSuggestionCount) {
    const fallbackCatalogSuggestions = await fetchCatalogSuggestionsFromLibraryArtists(
      music,
      libraryPool,
      {
        limit: desiredSuggestionCount - suggestionPool.length + 12,
        excludeIds: new Set<string>([
          ...libraryIds,
          ...suggestionPool.map((track) => track.id),
        ]),
        excludeKeys: new Set<string>([
          ...libraryKeys,
          ...suggestionPool.map((track) => buildTrackHistoryKey(track)),
        ]),
        maxArtists: 14,
        searchLimitPerArtist: 14,
      }
    );
    suggestionPool = dedupeTrackRefs([...suggestionPool, ...fallbackCatalogSuggestions], {
      excludeIds: libraryIds,
      excludeKeys: libraryKeys,
    });
  }

  const tuneInHistoryEntries = readTuneInHistoryEntriesForSelection();
  const mixSeedBase = `${Date.now()}::${targetSize}::${libraryPool.length}::${suggestionPool.length}`;
  let mixResult = buildTuneInMix(
    libraryPool,
    suggestionPool,
    targetSize,
    tuneInHistoryEntries,
    `${mixSeedBase}::initial`
  );
  let mixedTracks = mixResult.tracks as AppleMusicTuneInTrackRef[];

  if (mixedTracks.length < targetSize) {
    const expandedCatalogSuggestions = await fetchCatalogSuggestionsFromLibraryArtists(
      music,
      libraryPool,
      {
        limit: Math.max(targetSize * 2, 160),
        excludeIds: new Set<string>([
          ...libraryIds,
          ...suggestionPool.map((track) => track.id),
        ]),
        excludeKeys: new Set<string>([
          ...libraryKeys,
          ...suggestionPool.map((track) => buildTrackHistoryKey(track)),
        ]),
        maxArtists: 24,
        searchLimitPerArtist: 22,
      }
    );
    if (expandedCatalogSuggestions.length > 0) {
      suggestionPool = dedupeTrackRefs([...suggestionPool, ...expandedCatalogSuggestions], {
        excludeIds: libraryIds,
        excludeKeys: libraryKeys,
      });
      mixResult = buildTuneInMix(
        libraryPool,
        suggestionPool,
        targetSize,
        tuneInHistoryEntries,
        `${mixSeedBase}::expanded_suggestions`
      );
      mixedTracks = mixResult.tracks as AppleMusicTuneInTrackRef[];
    }
  }

  if (mixedTracks.length < targetSize) {
    const expandedLibraryPool = dedupeTrackRefs([
      ...libraryPool,
      ...(await fetchLibrarySongPool(music, { limit: 400 })),
    ]);
    if (expandedLibraryPool.length > libraryPool.length) {
      libraryPool = expandedLibraryPool;
      indexLibraryTracks(libraryPool);
      suggestionPool = dedupeTrackRefs(suggestionPool, {
        excludeIds: libraryIds,
        excludeKeys: libraryKeys,
      });
      mixResult = buildTuneInMix(
        libraryPool,
        suggestionPool,
        targetSize,
        tuneInHistoryEntries,
        `${mixSeedBase}::expanded_library`
      );
      mixedTracks = mixResult.tracks as AppleMusicTuneInTrackRef[];
    }
  }

  if (mixedTracks.length === 0) {
    throw new Error("Tune-In queue could not be assembled.");
  }
  if (mixedTracks.length < Math.min(16, targetSize)) {
    console.warn("[W.A.I.V.][Tune-In Mix Warning] limited diverse pool size", {
      mixedTrackCount: mixedTracks.length,
      targetSize,
    });
  }
  console.info("[W.A.I.V.][Tune-In Mix Stats]", mixResult.stats);

  const libraryTrackIndex = buildLibraryTrackIndexes(libraryPool);
  const heavyRotationOpeningTracks = heavyRotationRefs.slice(0, 180);
  const mostPlayedLibraryTracks = buildMostPlayedLibraryTrackRefs(libraryTrackIndex, {
    sinceDays: 90,
    limit: 180,
  });
  const favoriteLibraryTracks = mapCandidateRefsToLibraryTracks(
    favoriteLibraryRefsRaw,
    libraryTrackIndex,
    180
  );
  const recentlyPlayedLibraryTracks = mapCandidateRefsToLibraryTracks(
    recentlyPlayedRefsRaw,
    libraryTrackIndex,
    180
  );
  const suggestionFallbackTracks = mixedTracks
    .filter((track) => track.source === "suggestion")
    .slice(0, 180);

  const openingBuckets: {
    heavyRotation: TuneInOpeningTrackCandidate[];
    mostPlayed: TuneInOpeningTrackCandidate[];
    favorites: TuneInOpeningTrackCandidate[];
    recentlyPlayed: TuneInOpeningTrackCandidate[];
    suggestionFallback: TuneInOpeningTrackCandidate[];
  } = {
    heavyRotation: heavyRotationOpeningTracks.map((track) =>
      toOpeningTrackCandidate(track, "library")
    ),
    mostPlayed: mostPlayedLibraryTracks.map((track) =>
      toOpeningTrackCandidate(track, "library")
    ),
    favorites: favoriteLibraryTracks.map((track) =>
      toOpeningTrackCandidate(track, "library")
    ),
    recentlyPlayed: recentlyPlayedLibraryTracks.map((track) =>
      toOpeningTrackCandidate(track, "library")
    ),
    suggestionFallback: suggestionFallbackTracks.map((track) =>
      toOpeningTrackCandidate(track, "suggestion")
    ),
  };

  const openingCandidateTrackIds = Array.from(
    new Set(
      [
        ...openingBuckets.heavyRotation,
        ...openingBuckets.mostPlayed,
        ...openingBuckets.favorites,
        ...openingBuckets.recentlyPlayed,
        ...openingBuckets.suggestionFallback,
      ].map((track) => track.id)
    )
  );
  if (openingCandidateTrackIds.length === 0) {
    throw new Error(
      "Couldn't find an opening song for Tune-In. Please reconnect Apple Music and try again."
    );
  }

  const openingAvailability = await resolvePlayableTrackIds(
    openingCandidateTrackIds,
    music,
    {
      strict: true,
      validateLeadingCount: 5,
      contextLabel: "tune_in_opening_track",
    }
  );
  const playableOpeningIds = new Set(openingAvailability.playableTrackIds);
  const recentOpeningSignals = readRecentTuneInSessionFirstTrackSignals(12);
  const openingSelection = selectOpeningTrackByPriority({
    buckets: openingBuckets,
    isPlayable: (trackId) => playableOpeningIds.has(trackId),
    selectionPolicy: {
      previousSessionFirstTrackId: recentOpeningSignals.previousId,
      previousSessionFirstTrackKey: recentOpeningSignals.previousKey,
      recentFirstTrackIds: recentOpeningSignals.ids,
      recentFirstTrackKeys: recentOpeningSignals.keys,
    },
  });
  if (!openingSelection) {
    throw new Error(
      "Couldn't start Tune-In because your opening songs were unavailable. Please retry."
    );
  }
  console.info("[W.A.I.V.][Tune-In Opening Track Selected]", {
    firstTrackSource: openingSelection.source,
    firstTrackId: openingSelection.track.id,
    previousSessionFirstTrackId: recentOpeningSignals.previousId,
    previousSessionFirstTrackKey: recentOpeningSignals.previousKey,
    recentFirstTrackIds: recentOpeningSignals.ids.slice(-5),
    recentFirstTrackKeys: recentOpeningSignals.keys.slice(-5),
  });

  const mixedTrackIndex = buildOpeningTrackMetadataIndex(mixedTracks);
  const openingTrack = coerceOpeningCandidateToTuneInTrack(
    openingSelection.track,
    mixedTrackIndex,
    libraryTrackIndex
  );
  const openingTrackKey = buildTrackHistoryKey(openingTrack);
  const withoutOpeningTrack = mixedTracks.filter((track) => {
    if (track.id === openingTrack.id) {
      return false;
    }
    if (!openingTrackKey) {
      return true;
    }
    return buildTrackHistoryKey(track) !== openingTrackKey;
  });
  mixedTracks = [openingTrack, ...withoutOpeningTrack].slice(0, targetSize);

  const libraryCount = mixedTracks.filter((track) => track.source === "library").length;
  const suggestionCount = mixedTracks.filter((track) => track.source === "suggestion").length;
  return {
    tracks: mixedTracks,
    libraryCount,
    suggestionCount,
    firstTrackSource: openingSelection.source,
    firstTrackId: openingSelection.track.id,
  };
}

export async function queueAppleMusicTuneInTracks(
  trackIds: string[],
  options?: {
    shuffle?: boolean;
    strictAvailability?: boolean;
    validateLeadingCount?: number;
    requiredVerifiedLeadingCount?: number;
  }
): Promise<string[]> {
  return await playAppleMusicSongsQueue(trackIds, {
    shuffle: options?.shuffle ?? false,
    contextLabel: "Tune-In",
    autoPlay: false,
    strictAvailability: options?.strictAvailability ?? false,
    validateLeadingCount: options?.validateLeadingCount ?? 5,
    requiredVerifiedLeadingCount: options?.requiredVerifiedLeadingCount ?? 1,
  });
}

export async function queueAppleMusicTrackIds(
  trackIds: string[],
  options?: {
    shuffle?: boolean;
    contextLabel?: string;
    autoPlay?: boolean;
    strictAvailability?: boolean;
    validateLeadingCount?: number;
    requiredVerifiedLeadingCount?: number;
  }
): Promise<string[]> {
  return await playAppleMusicSongsQueue(trackIds, {
    shuffle: options?.shuffle ?? false,
    contextLabel: options?.contextLabel ?? "track",
    autoPlay: options?.autoPlay ?? false,
    strictAvailability: options?.strictAvailability ?? false,
    validateLeadingCount: options?.validateLeadingCount ?? 3,
    requiredVerifiedLeadingCount: options?.requiredVerifiedLeadingCount ?? 1,
  });
}

export async function prepareAppleMusicTuneInSession(
  options?: {
    targetSize?: number;
    shuffle?: boolean;
    strictAvailability?: boolean;
    validateLeadingCount?: number;
    requiredVerifiedLeadingCount?: number;
  }
): Promise<AppleMusicTuneInSession> {
  const session = await buildAppleMusicTuneInSession(options);
  const queuedTrackIds = await playAppleMusicSongsQueue(
    session.tracks.map((track) => track.id),
    {
      shuffle: options?.shuffle ?? false,
      contextLabel: "Tune-In",
      autoPlay: false,
      strictAvailability: options?.strictAvailability ?? false,
      validateLeadingCount: options?.validateLeadingCount ?? 5,
      requiredVerifiedLeadingCount: options?.requiredVerifiedLeadingCount ?? 1,
    }
  );
  const queuedTrackIdSet = new Set(queuedTrackIds);
  const filteredTracks = session.tracks.filter((track) => queuedTrackIdSet.has(track.id));
  if (filteredTracks.length === 0) {
    throw new Error("Tune-In queue has no playable tracks after availability filtering.");
  }
  const openingTrackId = session.tracks[0]?.id ?? null;
  if (openingTrackId && !queuedTrackIdSet.has(openingTrackId)) {
    throw new Error(
      "Couldn't verify the opening song for Tune-In after queue validation. Please retry."
    );
  }
  return {
    tracks: filteredTracks,
    libraryCount: filteredTracks.filter((track) => track.source === "library").length,
    suggestionCount: filteredTracks.filter((track) => track.source === "suggestion").length,
    firstTrackSource: session.firstTrackSource,
    firstTrackId: session.firstTrackId,
  };
}

export async function startAppleMusicTuneInSession(
  options?: {
    targetSize?: number;
    shuffle?: boolean;
    strictAvailability?: boolean;
    validateLeadingCount?: number;
  }
): Promise<AppleMusicTuneInSession> {
  const session = await buildAppleMusicTuneInSession(options);
  const queuedTrackIds = await playAppleMusicSongsQueue(
    session.tracks.map((track) => track.id),
    {
      shuffle: options?.shuffle ?? false,
      contextLabel: "Tune-In",
      autoPlay: true,
      strictAvailability: options?.strictAvailability ?? false,
      validateLeadingCount: options?.validateLeadingCount ?? 5,
    }
  );
  const queuedTrackIdSet = new Set(queuedTrackIds);
  const filteredTracks = session.tracks.filter((track) => queuedTrackIdSet.has(track.id));
  if (filteredTracks.length === 0) {
    throw new Error("Tune-In queue has no playable tracks after availability filtering.");
  }
  const openingTrackId = session.tracks[0]?.id ?? null;
  if (openingTrackId && !queuedTrackIdSet.has(openingTrackId)) {
    throw new Error(
      "Couldn't verify the opening song for Tune-In after queue validation. Please retry."
    );
  }
  return {
    tracks: filteredTracks,
    libraryCount: filteredTracks.filter((track) => track.source === "library").length,
    suggestionCount: filteredTracks.filter((track) => track.source === "suggestion").length,
    firstTrackSource: session.firstTrackSource,
    firstTrackId: session.firstTrackId,
  };
}

export async function playAppleMusicLibraryPlaylist(
  playlistId: string,
  options?: {
    shuffle?: boolean;
    strictAvailability?: boolean;
    validateLeadingCount?: number;
  }
): Promise<void> {
  const music = await initMusicKit();
  const trackIds = await fetchLibraryPlaylistTrackIds(playlistId, music);
  if (trackIds.length === 0) {
    throw new Error("Playlist has no playable tracks.");
  }

  await playAppleMusicSongsQueue(trackIds, {
    shuffle: options?.shuffle ?? false,
    contextLabel: "playlist",
    autoPlay: true,
    strictAvailability: options?.strictAvailability ?? false,
    validateLeadingCount: options?.validateLeadingCount ?? 5,
  });
}

export async function toggleAppleMusicPlayback(): Promise<boolean> {
  const music = await initMusicKit();
  const controller = music.player ?? music;
  const play = typeof controller.play === "function" ? controller.play.bind(controller) : null;
  const pause = typeof controller.pause === "function" ? controller.pause.bind(controller) : null;

  if (!play || !pause) {
    throw new Error("Playback controls are unavailable in MusicKit.");
  }

  const currentlyPlaying = Boolean(
    controller.isPlaying ??
      music.isPlaying ??
      (typeof music.playbackState === "number" && music.playbackState === 2)
  );

  if (currentlyPlaying) {
    await withTimeout(pause(), 4200, "Timed out while pausing playback.");
    return false;
  }

  await withTimeout(play(), 4200, "Timed out while starting playback.");
  return true;
}

export async function resumeAppleMusicPlayback(): Promise<void> {
  const music = await initMusicKit();
  const controller = music.player ?? music;
  const playPrimary = typeof controller.play === "function" ? controller.play.bind(controller) : null;
  const playFallback =
    controller !== music && typeof music.play === "function" ? music.play.bind(music) : null;
  if (!playPrimary && !playFallback) {
    throw new Error("Playback controls are unavailable in MusicKit.");
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (playPrimary) {
      try {
        await withTimeout(playPrimary(), 4200, "Timed out while resuming playback.");
        return;
      } catch (error) {
        lastError = error;
      }
    }
    if (playFallback) {
      try {
        await withTimeout(playFallback(), 4200, "Timed out while fallback resuming playback.");
        return;
      } catch (error) {
        lastError = error;
      }
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 160 + attempt * 100);
    });
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to resume playback.");
}

export async function pauseAppleMusicPlayback(): Promise<void> {
  const music = await initMusicKit();
  const controller = music.player ?? music;
  const pausePrimary = typeof controller.pause === "function" ? controller.pause.bind(controller) : null;
  const pauseFallback =
    controller !== music && typeof music.pause === "function" ? music.pause.bind(music) : null;
  if (!pausePrimary && !pauseFallback) {
    throw new Error("Playback controls are unavailable in MusicKit.");
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (pausePrimary) {
      try {
        await withTimeout(pausePrimary(), 2200, "Timed out while pausing playback.");
        return;
      } catch (error) {
        lastError = error;
      }
    }
    if (pauseFallback) {
      try {
        await withTimeout(pauseFallback(), 2200, "Timed out while fallback pausing playback.");
        return;
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to pause playback.");
}

export async function getAppleMusicNowPlaying(): Promise<AppleMusicNowPlaying | null> {
  const music = await initMusicKit();
  const controller = music.player ?? music;

  const item = (controller.nowPlayingItem ?? music.nowPlayingItem) as
    | {
        id?: string | number;
        name?: string;
        title?: string;
        artistName?: string;
        artworkURL?: string;
        artwork?: { url?: string };
        durationInMillis?: number;
        albumName?: string;
        attributes?: {
          name?: string;
          title?: string;
          artistName?: string;
          albumName?: string;
          albumTitle?: string;
          artwork?: { url?: string };
          durationInMillis?: number;
          playParams?: {
            id?: string;
            catalogId?: string;
            albumId?: string;
          };
        };
        relationships?: {
          albums?: {
            data?: Array<{ id?: string; attributes?: { name?: string } }>;
          };
        };
      }
    | undefined;

  const title = item?.attributes?.name ?? item?.attributes?.title ?? item?.title ?? item?.name;
  const artistName = item?.attributes?.artistName ?? item?.artistName;
  if (!title) {
    return null;
  }
  const id =
    item?.attributes?.playParams?.catalogId ??
    item?.attributes?.playParams?.id ??
    item?.id ??
    `${title}::${artistName ?? "unknown"}`;
  const albumIdRaw =
    item?.attributes?.playParams?.albumId ??
    item?.relationships?.albums?.data?.[0]?.id ??
    null;
  const albumId =
    typeof albumIdRaw === "string" && albumIdRaw.trim().length > 0 ? albumIdRaw.trim() : null;
  const albumTitleRaw =
    item?.attributes?.albumName ??
    item?.attributes?.albumTitle ??
    item?.albumName ??
    item?.relationships?.albums?.data?.[0]?.attributes?.name ??
    null;
  const albumTitle =
    typeof albumTitleRaw === "string" && albumTitleRaw.trim().length > 0
      ? albumTitleRaw.trim()
      : null;

  const time = typeof controller.currentPlaybackTime === "number" ? controller.currentPlaybackTime : 0;
  const durationFromItemMs =
    item?.attributes?.durationInMillis ?? item?.durationInMillis ?? 0;
  const duration =
    typeof controller.currentPlaybackDuration === "number" && controller.currentPlaybackDuration > 0
      ? controller.currentPlaybackDuration
      : durationFromItemMs > 0
        ? durationFromItemMs / 1000
      : 0;
  const progress = duration > 0 ? Math.max(0, Math.min(1, time / duration)) : 0;
  const artworkTemplate =
    item?.attributes?.artwork?.url ?? item?.artwork?.url ?? item?.artworkURL;

  return {
    id: String(id),
    title,
    artistName: artistName ?? "Unknown Artist",
    artworkUrl: buildArtworkUrl(artworkTemplate) ?? artworkTemplate ?? null,
    albumId,
    albumTitle,
    progress,
    isPlaying: isControllerPlaying(controller, music),
  };
}

export async function skipAppleMusicToNext(): Promise<void> {
  const music = await initMusicKit();
  const controller = music.player ?? music;
  const skip = getSkipNextFn(controller);
  if (!skip) {
    throw new Error("Next track control is unavailable.");
  }

  const beforeId = getNowPlayingIdentity(controller, music);
  const recovered = await skipForwardUntilPlayable(controller, music, {
    skipFn: skip,
    maxSkips: 10,
    contextLabel: "next-track",
    requireAdvance: true,
    initialPreviousId: beforeId,
  });

  if (!recovered) {
    throw new Error("Skip command did not reach a playable next track.");
  }
}

export async function skipAppleMusicToPrevious(): Promise<void> {
  const music = await initMusicKit();
  const controller = music.player ?? music;
  const skip = getSkipPreviousFn(controller);
  if (!skip) {
    throw new Error("Previous track control is unavailable.");
  }
  await withTimeout(skip(), 4200, "Timed out while skipping to previous track.");
  await ensurePlayingState(controller, music, "previous-track playback");
}

export async function getAppleMusicVolume(): Promise<number> {
  const music = await initMusicKit();
  const controller = music.player ?? music;
  const volume = controller.volume ?? music.volume;
  if (typeof volume !== "number" || Number.isNaN(volume)) {
    return 1;
  }
  return Math.max(0, Math.min(1, volume));
}

export async function setAppleMusicVolume(volume: number): Promise<void> {
  const music = await initMusicKit();
  const controller = music.player ?? music;
  const next = Math.max(0, Math.min(1, volume));

  if (typeof controller.volume === "number") {
    controller.volume = next;
    return;
  }

  if (typeof music.volume === "number") {
    music.volume = next;
  }
}

export async function primeAppleMusicPlaybackHead(options?: {
  maxSkipAttempts?: number;
}): Promise<AppleMusicNowPlaying | null> {
  const originalVolume = await getAppleMusicVolume().catch(() => 1);
  await setAppleMusicVolume(0).catch(() => {});

  let recovered = false;
  try {
    recovered = await ensureAppleMusicPlayback({
      maxResumeAttempts: 2,
      maxSkipAttempts: Math.max(4, Math.min(20, options?.maxSkipAttempts ?? 14)),
    });

    const nowPlaying = recovered ? await getAppleMusicNowPlaying().catch(() => null) : null;
    await pauseAppleMusicPlayback().catch(() => {});
    return nowPlaying;
  } finally {
    await setAppleMusicVolume(originalVolume).catch(() => {});
  }
}
