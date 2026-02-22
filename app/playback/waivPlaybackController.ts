import {
  ensureAppleMusicPlayback,
  getAppleMusicNowPlaying,
  pauseAppleMusicPlayback,
  primeAppleMusicPlaybackHead,
  prepareAppleMusicTuneInSession,
  queueAppleMusicTrackIds,
  skipAppleMusicToNext,
  toggleAppleMusicPlayback,
} from "../appleMusicClient";
import caseyIntroLibraryRaw from "../introScripts/casey.json";
import marcusIntroLibraryRaw from "../introScripts/marcus.json";
import { buildCanonicalTrackKey } from "../trackIdentity";
import { AudioOrchestrator } from "./audioOrchestrator";
import { sanitizeSpokenArtist, sanitizeSpokenTitle } from "./sanitization";
import { PlayerStateMachine, type PlayerStateSnapshot } from "./playerStateMachine";
import type { PlaybackTrack, SessionStartResult } from "./types";

type ControllerDj = {
  id: string;
  name: string;
};

type StartSessionInput = {
  dj: ControllerDj;
};

type ControllerDeps = {
  onToast: (message: string, durationMs?: number) => void;
  onTelemetry: (eventName: string, payload: Record<string, unknown>) => void;
  onStateChange?: (snapshot: PlayerStateSnapshot) => void;
  onTrackStarted?: (input: {
    track: PlaybackTrack;
    sessionId: string;
    firstTrackSource?: "heavy_rotation" | "favorites" | "library" | "none";
    firstTrackId?: string | null;
  }) => void;
  onNowPlaying?: (input: {
    id: string;
    title: string;
    artistName: string;
    albumId?: string | null;
    albumTitle?: string | null;
    artworkUrl: string | null;
    progress: number;
    isPlaying: boolean;
  } | null) => void;
};

type SessionIntroScript = {
  id: string;
  script_body: string;
};

type SessionIntroLibrary = {
  dj: string;
  intros: SessionIntroScript[];
};

const SESSION_INTRO_LIBRARIES: Record<string, SessionIntroLibrary> = {
  casey: caseyIntroLibraryRaw as SessionIntroLibrary,
  marcus: marcusIntroLibraryRaw as SessionIntroLibrary,
};
const UNAVAILABLE_TOAST_VARIANTS = [
  "That one’s off the air — rolling the next track.",
  "Couldn’t play that one. Keeping the music moving.",
  "That track’s unavailable right now — spinning the next one.",
  "That one didn’t clear — moving to the next record.",
  "Couldn’t lock that track in — going to the next one.",
] as const;

const CASEY_TRACK_INTRO_TEMPLATES_LIBRARY = [
  "Up next: “[SONG TITLE]” by [ARTIST].",
  "Coming in now, “[SONG TITLE]” by [ARTIST].",
  "Now spinning “[SONG TITLE]” from [ARTIST].",
  "Keeping it moving with “[SONG TITLE]” by [ARTIST].",
  "Next in rotation: “[SONG TITLE]” by [ARTIST].",
] as const;

const CASEY_TRACK_INTRO_TEMPLATES_SUGGESTION = [
  "Quick suggestion for you: “[SONG TITLE]” by [ARTIST].",
  "Not in your library yet, but it fits — “[SONG TITLE]” by [ARTIST].",
  "Fresh pick based on your taste: “[SONG TITLE]” by [ARTIST].",
  "Suggestion coming in now — “[SONG TITLE]” by [ARTIST].",
  "Here’s a recommendation for this run: “[SONG TITLE]” by [ARTIST].",
] as const;

const PLAYBACK_STALL_THRESHOLD_MS = 5200;
const PLAYBACK_STALL_RETRY_BACKOFF_MS = 4200;

function buildTrackMatchKey(track: { title: string; artistName: string }): string {
  return buildCanonicalTrackKey({
    title: track.title,
    artistName: track.artistName,
  });
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `waiv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export class WaivPlaybackController {
  private readonly deps: ControllerDeps;
  private readonly state = new PlayerStateMachine();
  private readonly audio = new AudioOrchestrator();

  private sessionId: string | null = null;
  private activeDj: ControllerDj | null = null;
  private pollInterval: number | null = null;
  private inFlight = false;
  private userPaused = false;
  private sessionTrackById = new Map<string, PlaybackTrack>();
  private sessionTrackByMatchKey = new Map<string, PlaybackTrack>();
  private firstTrackIdForSession: string | null = null;
  private firstTrackSourceForSession: SessionStartResult["firstTrackSource"] = "none";
  private lastReportedNowPlayingTrackId: string | null = null;
  private lastIntroIdByDj = new Map<string, string>();
  private lastTrackIntroTemplateByDj = new Map<string, string>();
  private playbackStallSinceMs: number | null = null;
  private playbackStallTrackId: string | null = null;
  private lastObservedProgress = 0;
  private lastObservedProgressAtMs: number | null = null;
  private lastObservedProgressTrackId: string | null = null;
  private playbackStallBackoffUntilMs: number | null = null;
  private stallRecoveryInFlight = false;
  private stallRecoveryAttempts = 0;
  private sessionIntroInFlight = false;
  private trackIntroInFlight = false;
  private pendingTrackIntros: PlaybackTrack[] = [];
  private allowTrackIntros = false;

  constructor(deps: ControllerDeps) {
    this.deps = deps;
    this.startPolling();
  }

  dispose(): void {
    if (this.pollInterval !== null && typeof window !== "undefined") {
      window.clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.audio.dispose();
    this.state.reset();
  }

  getSnapshot(): PlayerStateSnapshot {
    return this.state.getSnapshot();
  }

  async startNewSession(input: StartSessionInput): Promise<SessionStartResult> {
    if (this.inFlight) {
      return {
        ok: false,
        sessionId: this.sessionId,
        firstTrack: null,
        firstTrackSource: "none",
        error: "busy",
      };
    }

    this.inFlight = true;
    try {
      const sessionId = createSessionId();
      this.sessionId = sessionId;
      this.activeDj = input.dj;
      this.userPaused = false;
      this.sessionTrackById.clear();
      this.sessionTrackByMatchKey.clear();
      this.firstTrackIdForSession = null;
      this.firstTrackSourceForSession = "none";
      this.lastReportedNowPlayingTrackId = null;
      this.playbackStallSinceMs = null;
      this.playbackStallTrackId = null;
      this.lastObservedProgress = 0;
      this.lastObservedProgressAtMs = null;
      this.lastObservedProgressTrackId = null;
      this.playbackStallBackoffUntilMs = null;
      this.stallRecoveryInFlight = false;
      this.stallRecoveryAttempts = 0;
      this.sessionIntroInFlight = false;
      this.trackIntroInFlight = false;
      this.pendingTrackIntros = [];
      this.allowTrackIntros = false;

      this.state.beginSession(sessionId);
      this.emitState();

      if (!this.hasSessionIntroLibrary(input.dj.id)) {
        this.state.fail("intro_system_reset_in_progress");
        this.emitState();

        this.deps.onTelemetry("session_intro_system_reset_blocked", {
          session_id: sessionId,
          dj_id: input.dj.id,
        });

        this.deps.onToast("DJ intros are being reset. Casey and Marcus are available for testing.");

        return {
          ok: false,
          sessionId,
          firstTrack: null,
          firstTrackSource: "none",
          error: "intro_system_reset_in_progress",
        };
      }

      this.state.transition("starting_track", "session_preparing");
      this.emitState();

      const session = await this.prepareSessionReliably();

      const mappedTracks: PlaybackTrack[] = session.tracks.map((track) => ({
        id: track.id,
        title: track.title,
        artistName: track.artistName,
        source: track.source,
        genreTag: track.genreTag ?? null,
        albumId: track.albumId ?? null,
        albumTitle: track.albumTitle ?? null,
      }));

      const firstTrack = mappedTracks[0] ?? null;
      if (!firstTrack) {
        this.state.fail("session_empty");
        this.emitState();
        this.deps.onToast("Could not start playback right now.");
        return {
          ok: false,
          sessionId,
          firstTrack: null,
          firstTrackSource: "none",
          error: "session_empty",
        };
      }

      for (const track of mappedTracks) {
        this.sessionTrackById.set(track.id, track);
        this.sessionTrackByMatchKey.set(
          buildTrackMatchKey({ title: track.title, artistName: track.artistName }),
          track
        );
      }

      const firstTrackSource = this.mapFirstTrackSource(session.firstTrackSource);
      let primedNowPlaying = await primeAppleMusicPlaybackHead({
        maxSkipAttempts: 14,
      }).catch(() => null);

      if (!primedNowPlaying) {
        this.deps.onTelemetry("session_start_prime_head_null", {
          session_id: sessionId,
          dj_id: input.dj.id,
          expected_first_track_id: firstTrack.id,
          queue_size: mappedTracks.length,
        });

        try {
          await queueAppleMusicTrackIds(
            mappedTracks.map((track) => track.id),
            {
              shuffle: false,
              contextLabel: "Tune-In-reprime",
              autoPlay: false,
              strictAvailability: true,
              validateLeadingCount: 8,
              requiredVerifiedLeadingCount: 1,
            }
          );
          this.deps.onTelemetry("session_start_prime_head_requeued", {
            session_id: sessionId,
            dj_id: input.dj.id,
            expected_first_track_id: firstTrack.id,
          });

          primedNowPlaying = await primeAppleMusicPlaybackHead({
            maxSkipAttempts: 14,
          }).catch(() => null);
        } catch (error) {
          this.deps.onTelemetry("session_start_prime_head_requeue_failed", {
            session_id: sessionId,
            dj_id: input.dj.id,
            expected_first_track_id: firstTrack.id,
            reason: error instanceof Error && error.message ? error.message : "unknown",
          });
        }
      }

      if (!primedNowPlaying) {
        this.deps.onTelemetry("session_start_prime_head_unresolved", {
          session_id: sessionId,
          dj_id: input.dj.id,
          expected_first_track_id: firstTrack.id,
        });
      }

      const primedTrack =
        this.trackFromNowPlayingSessionOnly(primedNowPlaying) ??
        this.sessionTrackById.get(firstTrack.id) ??
        firstTrack;

      if (primedNowPlaying && !this.trackFromNowPlayingSessionOnly(primedNowPlaying)) {
        this.deps.onTelemetry("session_start_now_playing_mismatch", {
          session_id: sessionId,
          dj_id: input.dj.id,
          now_playing_id: primedNowPlaying.id,
          expected_first_track_id: firstTrack.id,
        });
      }

      this.firstTrackIdForSession = primedTrack.id;
      this.firstTrackSourceForSession = firstTrackSource;

      const intro = this.buildSessionIntroScript(input.dj, primedTrack);
      this.deps.onTelemetry("tune_in_intro_selected", {
        session_id: sessionId,
        dj_id: input.dj.id,
        intro_id: intro.introId,
        primed_first_track_id: primedTrack.id,
        primed_first_track_title: primedTrack.title,
        primed_first_track_artist: primedTrack.artistName,
        primed_first_track_source: primedTrack.source,
      });

      try {
        this.sessionIntroInFlight = true;
        this.state.transition("starting_track", "playing_intro");
        this.emitState();
        await this.ensureTransportPausedBeforeIntro();

        let playbackRecovered = false;
        let introDucked = false;
        let voiceResult = { started: false, completed: false, durationMs: 0 };
        try {
          await this.audio.duckMusicVolume(0.34, 260);
          introDucked = true;
        } catch {
          introDucked = false;
        }
        try {
          voiceResult = await this.audio.playVoiceLine({
            djId: input.dj.id,
            text: intro.script,
            overlapStartMsBeforeEnd: 5000,
            onOverlapStart: async () => {
              if (playbackRecovered) {
                return;
              }
              playbackRecovered = await ensureAppleMusicPlayback({
                maxResumeAttempts: 2,
                maxSkipAttempts: 10,
              });
            },
          });
        } finally {
          if (introDucked) {
            await this.audio.restoreMusicVolume(360).catch(() => {});
          }
        }

        if (!playbackRecovered) {
          playbackRecovered = await ensureAppleMusicPlayback({
            maxResumeAttempts: 4,
            maxSkipAttempts: 10,
          });
        }

        if (!voiceResult.started) {
          this.state.fail("intro_audio_not_started");
          this.emitState();
          this.deps.onToast("Could not play DJ intro audio.");
          return {
            ok: false,
            sessionId,
            firstTrack: null,
            firstTrackSource: "none",
            error: "intro_audio_not_started",
          };
        }

        if (!playbackRecovered) {
          this.state.fail("playback_start_failed");
          this.emitState();
          this.deps.onToast("Could not start playback right now.");
          return {
            ok: false,
            sessionId,
            firstTrack: null,
            firstTrackSource: "none",
            error: "playback_start_failed",
          };
        }

        this.state.transition("playing", "session_started");
        this.allowTrackIntros = true;
        this.emitState();

        this.deps.onTelemetry("session_intro_enabled", {
          session_id: sessionId,
          dj_id: input.dj.id,
          first_track_source: firstTrackSource,
          first_track_id: firstTrack.id,
        });

        return {
          ok: true,
          sessionId,
          firstTrack: primedTrack,
          firstTrackSource,
        };
      } finally {
        this.sessionIntroInFlight = false;
      }
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "unknown";
      this.state.fail("session_start_failed");
      this.emitState();
      this.deps.onTelemetry("session_start_failed", {
        session_id: this.sessionId,
        dj_id: input.dj.id,
        reason: message,
      });
      this.deps.onToast("Could not start playback right now.");
      return {
        ok: false,
        sessionId: this.sessionId,
        firstTrack: null,
        firstTrackSource: "none",
        error: "session_start_failed",
      };
    } finally {
      this.inFlight = false;
    }
  }

  async togglePlayPause(): Promise<boolean> {
    const playing = await toggleAppleMusicPlayback();
    this.userPaused = !playing;
    this.state.transition(playing ? "playing" : "paused", playing ? "resume" : "pause");
    this.emitState();
    return playing;
  }

  async skipNext(): Promise<boolean> {
    if (!this.hasSessionIntroLibrary(this.activeDj?.id ?? null)) {
      this.deps.onTelemetry("skip_blocked_intro_system_reset", {
        session_id: this.sessionId,
        dj_id: this.activeDj?.id ?? null,
      });
      this.deps.onToast("Skipping is unavailable while DJ intros are being reset for this DJ.");
      return false;
    }

    try {
      this.state.transition("starting_track", "skip_next");
      this.emitState();

      await skipAppleMusicToNext();
      const playbackRecovered = await ensureAppleMusicPlayback({
        maxResumeAttempts: 2,
        maxSkipAttempts: 2,
      });
      if (!playbackRecovered) {
        this.state.fail("skip_next_unavailable");
        this.emitState();
        return false;
      }

      const nowPlaying = await getAppleMusicNowPlaying().catch(() => null);
      if (nowPlaying) {
        this.reportNowPlayingTrackStart(nowPlaying);
      }

      this.state.transition("playing", "skip_next_success");
      this.emitState();
      return true;
    } catch {
      this.state.fail("skip_next_failed");
      this.emitState();
      return false;
    }
  }

  private startPolling(): void {
    if (typeof window === "undefined") {
      return;
    }

    this.pollInterval = window.setInterval(() => {
      void this.pollNowPlaying();
    }, 700);
  }

  private async pollNowPlaying(): Promise<void> {
    const nowPlaying = await getAppleMusicNowPlaying().catch(() => null);
    this.deps.onNowPlaying?.(nowPlaying);

    if (!nowPlaying) {
      this.playbackStallSinceMs = null;
      this.playbackStallTrackId = null;
      this.lastObservedProgress = 0;
      this.lastObservedProgressAtMs = null;
      this.lastObservedProgressTrackId = null;
      this.playbackStallBackoffUntilMs = null;
      this.stallRecoveryAttempts = 0;
      if (this.state.getSnapshot().state === "playing" && !this.userPaused) {
        this.state.transition("idle", "transport_idle");
        this.emitState();
      }
      return;
    }

    const now = Date.now();
    const snapshotState = this.state.getSnapshot().state;
    const activeDjId = this.activeDj?.id ?? null;
    const introSystemReady =
      this.allowTrackIntros && this.hasSessionIntroLibrary(activeDjId);
    const sessionReadyForRecovery =
      Boolean(this.sessionId) &&
      !this.userPaused &&
      !this.sessionIntroInFlight &&
      !this.stallRecoveryInFlight &&
      introSystemReady &&
      (snapshotState === "playing" || snapshotState === "buffering");

    const isTrackChange = this.lastObservedProgressTrackId !== nowPlaying.id;
    if (isTrackChange) {
      this.lastObservedProgressTrackId = nowPlaying.id;
      this.lastObservedProgress = nowPlaying.progress;
      this.lastObservedProgressAtMs = now;
      this.playbackStallTrackId = nowPlaying.id;
      this.playbackStallSinceMs = nowPlaying.isPlaying ? null : now;
      this.playbackStallBackoffUntilMs = null;
      this.stallRecoveryAttempts = 0;
    } else {
      const progressDelta = nowPlaying.progress - this.lastObservedProgress;
      const progressAdvanced = progressDelta > 0.0005;

      if (progressAdvanced) {
        this.lastObservedProgress = nowPlaying.progress;
        this.lastObservedProgressAtMs = now;
        this.playbackStallSinceMs = null;
        this.playbackStallBackoffUntilMs = null;
        this.stallRecoveryAttempts = 0;
      } else if (progressDelta < -0.01) {
        // Handle unexpected timeline jumps (seek/scrub/metadata reset).
        this.lastObservedProgress = nowPlaying.progress;
        this.lastObservedProgressAtMs = now;
        this.playbackStallSinceMs = null;
        this.playbackStallBackoffUntilMs = null;
        this.stallRecoveryAttempts = 0;
      } else if (this.lastObservedProgressAtMs === null) {
        this.lastObservedProgressAtMs = now;
      }

      if (nowPlaying.isPlaying) {
        this.playbackStallSinceMs = null;
      } else if (this.playbackStallSinceMs === null) {
        this.playbackStallSinceMs = now;
      }

      const withinBackoffWindow =
        Boolean(this.playbackStallBackoffUntilMs) &&
        now < (this.playbackStallBackoffUntilMs ?? 0);
      if (!withinBackoffWindow && sessionReadyForRecovery) {
        const isPlayingFalseStallMs =
          !nowPlaying.isPlaying && this.playbackStallSinceMs
            ? now - this.playbackStallSinceMs
            : null;
        const progressStallMs =
          nowPlaying.isPlaying && this.lastObservedProgressAtMs
            ? now - this.lastObservedProgressAtMs
            : null;

        if (isPlayingFalseStallMs !== null && isPlayingFalseStallMs >= PLAYBACK_STALL_THRESHOLD_MS) {
          this.deps.onTelemetry("playback_stall_detected", {
            session_id: this.sessionId,
            dj_id: activeDjId,
            track_id: nowPlaying.id,
            stall_reason: "isPlaying_false",
            stall_ms: isPlayingFalseStallMs,
            progress: nowPlaying.progress,
            isPlaying: nowPlaying.isPlaying,
            attempt: this.stallRecoveryAttempts + 1,
          });
          void this.recoverFromUnavailableTrack(nowPlaying.id);
        } else if (
          progressStallMs !== null &&
          progressStallMs >= PLAYBACK_STALL_THRESHOLD_MS
        ) {
          this.deps.onTelemetry("playback_stall_detected", {
            session_id: this.sessionId,
            dj_id: activeDjId,
            track_id: nowPlaying.id,
            stall_reason: "progress_not_advancing",
            stall_ms: progressStallMs,
            progress: nowPlaying.progress,
            isPlaying: nowPlaying.isPlaying,
            attempt: this.stallRecoveryAttempts + 1,
          });
          void this.recoverFromUnavailableTrack(nowPlaying.id);
        }
      }
    }

    this.reportNowPlayingTrackStart(nowPlaying);

    if (!(this.sessionIntroInFlight && !nowPlaying.isPlaying)) {
      this.state.transition(nowPlaying.isPlaying ? "playing" : "buffering", "poll_now_playing");
      this.emitState();
    }
  }

  private emitState(): void {
    const snapshot = this.state.getSnapshot();
    this.deps.onStateChange?.(snapshot);
    this.deps.onTelemetry("player_state_changes", {
      session_id: snapshot.sessionId,
      state: snapshot.state,
      reason: snapshot.reason,
    });
  }

  async hardStop(): Promise<void> {
    this.userPaused = true;
    await pauseAppleMusicPlayback().catch(() => {});
    this.state.transition("paused", "hard_stop");
    this.emitState();
  }

  async resume(): Promise<void> {
    this.userPaused = false;
    await ensureAppleMusicPlayback({
      maxResumeAttempts: 2,
      maxSkipAttempts: 0,
    }).catch(() => {});
    this.state.transition("playing", "resume");
    this.emitState();
  }

  private mapFirstTrackSource(source: string): SessionStartResult["firstTrackSource"] {
    if (source === "heavy_rotation") {
      return "heavy_rotation";
    }
    if (source === "favorites") {
      return "favorites";
    }
    return "library";
  }

  private reportNowPlayingTrackStart(nowPlaying: {
    id: string;
    title: string;
    artistName: string;
    albumId?: string | null;
    albumTitle?: string | null;
  }): void {
    if (!this.sessionId || !nowPlaying.id) {
      return;
    }

    if (this.lastReportedNowPlayingTrackId === nowPlaying.id) {
      return;
    }

    this.lastReportedNowPlayingTrackId = nowPlaying.id;

    const sessionTrack =
      this.sessionTrackById.get(nowPlaying.id) ??
      this.sessionTrackByMatchKey.get(
        buildTrackMatchKey({
          title: nowPlaying.title,
          artistName: nowPlaying.artistName,
        })
      ) ??
      ({
        id: nowPlaying.id,
        title: nowPlaying.title,
        artistName: nowPlaying.artistName,
        source: "library",
        albumId: nowPlaying.albumId ?? null,
        albumTitle: nowPlaying.albumTitle ?? null,
      } satisfies PlaybackTrack);

    this.deps.onTrackStarted?.({
      track: sessionTrack,
      sessionId: this.sessionId,
      firstTrackSource:
        sessionTrack.id === this.firstTrackIdForSession
          ? this.firstTrackSourceForSession
          : undefined,
      firstTrackId: sessionTrack.id === this.firstTrackIdForSession ? this.firstTrackIdForSession : undefined,
    });

    if (
      this.allowTrackIntros &&
      this.hasSessionIntroLibrary(this.activeDj?.id ?? null) &&
      sessionTrack.id !== this.firstTrackIdForSession
    ) {
      this.scheduleTrackIntro(sessionTrack);
    }
  }

  private async prepareSessionReliably() {
    const strictAttempts = [
      {
        targetSize: 72,
        validateLeadingCount: 8,
        requiredVerifiedLeadingCount: 4,
      },
      {
        targetSize: 56,
        validateLeadingCount: 8,
        requiredVerifiedLeadingCount: 3,
      },
      {
        targetSize: 44,
        validateLeadingCount: 6,
        requiredVerifiedLeadingCount: 2,
      },
    ] as const;

    let lastError: unknown = null;
    for (let attempt = 0; attempt < strictAttempts.length; attempt += 1) {
      const config = strictAttempts[attempt];
      try {
        return await prepareAppleMusicTuneInSession({
          targetSize: config.targetSize,
          shuffle: false,
          strictAvailability: true,
          validateLeadingCount: config.validateLeadingCount,
          requiredVerifiedLeadingCount: config.requiredVerifiedLeadingCount,
        });
      } catch (error) {
        lastError = error;
        this.deps.onTelemetry("session_prepare_retry_strict_window", {
          session_id: this.sessionId,
          dj_id: this.activeDj?.id ?? null,
          attempt: attempt + 1,
          target_size: config.targetSize,
          validate_leading_count: config.validateLeadingCount,
          required_verified_leading_count: config.requiredVerifiedLeadingCount,
          reason: error instanceof Error && error.message ? error.message : "unknown",
        });
      }
    }

    throw (
      lastError ??
      new Error("Could not prepare a validated Tune-In session queue.")
    );
  }

  private async ensureTransportPausedBeforeIntro(): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await pauseAppleMusicPlayback().catch(() => {});
      const nowPlaying = await getAppleMusicNowPlaying().catch(() => null);
      if (!nowPlaying?.isPlaying) {
        return;
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 120 + attempt * 80);
      });
    }
  }

  private trackFromNowPlaying(nowPlaying: {
    id: string;
    title: string;
    artistName: string;
    albumId?: string | null;
    albumTitle?: string | null;
  } | null): PlaybackTrack | null {
    if (!nowPlaying?.id) {
      return null;
    }

    const byId = this.sessionTrackById.get(nowPlaying.id);
    if (byId) {
      return byId;
    }

    const byMatch = this.sessionTrackByMatchKey.get(
      buildTrackMatchKey({
        title: nowPlaying.title,
        artistName: nowPlaying.artistName,
      })
    );
    if (byMatch) {
      return byMatch;
    }

    return {
      id: nowPlaying.id,
      title: nowPlaying.title,
      artistName: nowPlaying.artistName,
      source: "library",
      albumId: nowPlaying.albumId ?? null,
      albumTitle: nowPlaying.albumTitle ?? null,
    };
  }

  private trackFromNowPlayingSessionOnly(nowPlaying: {
    id: string;
    title: string;
    artistName: string;
  } | null): PlaybackTrack | null {
    if (!nowPlaying?.id) {
      return null;
    }

    const byId = this.sessionTrackById.get(nowPlaying.id);
    if (byId) {
      return byId;
    }

    return (
      this.sessionTrackByMatchKey.get(
        buildTrackMatchKey({
          title: nowPlaying.title,
          artistName: nowPlaying.artistName,
        })
      ) ?? null
    );
  }

  private buildSessionIntroScript(
    dj: ControllerDj,
    track: PlaybackTrack
  ): { introId: string; script: string } {
    const library = this.getSessionIntroLibrary(dj.id);
    const intros = Array.isArray(library?.intros) ? library.intros : [];
    const available = intros.filter((intro) => intro?.id && intro?.script_body);
    if (available.length === 0) {
      const fallback = `You’re on W.A.I.V. I’m ${dj.name.split(",")[0] ?? "your DJ"}. Starting us off with “${sanitizeSpokenTitle(track.title)}” by ${sanitizeSpokenArtist(track.artistName)}.`;
      return { introId: `${dj.id}_fallback`, script: fallback };
    }

    const pool =
      available.length > 1 && this.lastIntroIdByDj.get(dj.id)
        ? available.filter((intro) => intro.id !== this.lastIntroIdByDj.get(dj.id))
        : available;
    const choices = pool.length > 0 ? pool : available;
    const chosen = choices[Math.floor(Math.random() * choices.length)] ?? choices[0];
    this.lastIntroIdByDj.set(dj.id, chosen.id);

    const safeTitle = sanitizeSpokenTitle(track.title);
    const safeArtist = sanitizeSpokenArtist(track.artistName);
    const script = chosen.script_body
      .split("[SONG TITLE]")
      .join(safeTitle)
      .split("[ARTIST]")
      .join(safeArtist)
      .trim();
    return {
      introId: chosen.id,
      script,
    };
  }

  private scheduleTrackIntro(track: PlaybackTrack): void {
    if (!track.id) {
      return;
    }

    this.pendingTrackIntros.push(track);
    if (this.trackIntroInFlight) {
      return;
    }

    void this.playTrackIntroLoop();
  }

  private async playTrackIntroLoop(): Promise<void> {
    while (this.pendingTrackIntros.length > 0) {
      const current = this.pendingTrackIntros.shift();
      if (!current) {
        continue;
      }

      this.trackIntroInFlight = true;
      const nowPlaying = await getAppleMusicNowPlaying().catch(() => null);
      if (!nowPlaying || nowPlaying.id !== current.id) {
        this.trackIntroInFlight = false;
        continue;
      }

      const activeDjId = this.activeDj?.id ?? "casey";
      const line = this.buildTrackLine(activeDjId, current);
      let voiceStarted = false;
      let spokenLine = line;

      try {
        await this.audio.duckMusicVolume(0.34, 260);
        const voiceResult = await this.audio.playVoiceLine({
          djId: activeDjId,
          text: line,
        });
        voiceStarted = voiceResult.started;

        if (!voiceStarted) {
          const fallbackLine =
            current.source === "suggestion"
              ? `Suggestion up next: “${sanitizeSpokenTitle(current.title)}” by ${sanitizeSpokenArtist(current.artistName)}.`
              : `Up next: “${sanitizeSpokenTitle(current.title)}” by ${sanitizeSpokenArtist(current.artistName)}.`;
          const fallbackResult = await this.audio.playVoiceLine({
            djId: activeDjId,
            text: fallbackLine,
          });
          voiceStarted = fallbackResult.started;
          if (voiceStarted) {
            spokenLine = fallbackLine;
          }
        }
      } catch {
        // Best-effort track hosting.
      } finally {
        await this.audio.restoreMusicVolume(320).catch(() => {});
      }

      this.deps.onTelemetry("dj_intro_played", {
        session_id: this.sessionId,
        dj_id: this.activeDj?.id ?? null,
        track_id: current.id,
        dj_intro_played: voiceStarted,
        dj_intro_text_length_chars: spokenLine.length,
        dj_intro_includes_song_and_artist: true,
        track_is_suggestion: current.source === "suggestion",
        dj_labeled_suggestion:
          current.source !== "suggestion"
            ? null
            : /\b(suggestion|recommendation|fresh pick)\b/i.test(spokenLine),
      });

      this.trackIntroInFlight = false;
    }
  }

  private buildTrackLine(djId: string, track: PlaybackTrack): string {
    const title = sanitizeSpokenTitle(track.title);
    const artist = sanitizeSpokenArtist(track.artistName);
    const templates =
      track.source === "suggestion"
        ? CASEY_TRACK_INTRO_TEMPLATES_SUGGESTION
        : CASEY_TRACK_INTRO_TEMPLATES_LIBRARY;
    const template = this.pickTemplateAvoidRepeat(templates, this.lastTrackIntroTemplateByDj.get(djId) ?? null);
    this.lastTrackIntroTemplateByDj.set(djId, template);
    return template
      .split("[SONG TITLE]")
      .join(title)
      .split("[ARTIST]")
      .join(artist);
  }

  private hasSessionIntroLibrary(djId: string | null): boolean {
    if (!djId) {
      return false;
    }
    const library = this.getSessionIntroLibrary(djId);
    return Boolean(library && Array.isArray(library.intros) && library.intros.length > 0);
  }

  private getSessionIntroLibrary(djId: string): SessionIntroLibrary | null {
    return SESSION_INTRO_LIBRARIES[djId] ?? null;
  }

  private pickTemplateAvoidRepeat<T extends readonly string[]>(
    templates: T,
    previous: string | null
  ): T[number] {
    if (templates.length === 1) {
      return templates[0];
    }
    const pool = previous ? templates.filter((template) => template !== previous) : [...templates];
    const chosenPool = pool.length > 0 ? pool : [...templates];
    return chosenPool[Math.floor(Math.random() * chosenPool.length)] as T[number];
  }

  private async recoverFromUnavailableTrack(trackId: string): Promise<void> {
    this.stallRecoveryInFlight = true;
    this.stallRecoveryAttempts += 1;
    const variant =
      UNAVAILABLE_TOAST_VARIANTS[Math.floor(Math.random() * UNAVAILABLE_TOAST_VARIANTS.length)] ??
      UNAVAILABLE_TOAST_VARIANTS[0];
    this.deps.onToast(variant, 3600);
    this.deps.onTelemetry("track_unavailable_skipped", {
      session_id: this.sessionId,
      dj_id: this.activeDj?.id ?? null,
      trackId,
      reason: "buffering_timeout",
      attempt: this.stallRecoveryAttempts,
    });

    let recovered = false;
    try {
      await skipAppleMusicToNext();
      recovered = await ensureAppleMusicPlayback({
        maxResumeAttempts: 1,
        maxSkipAttempts: 1,
      });
    } catch {
      recovered = false;
    }

    if (recovered) {
      this.playbackStallSinceMs = null;
      this.playbackStallTrackId = null;
      this.playbackStallBackoffUntilMs = Date.now() + PLAYBACK_STALL_RETRY_BACKOFF_MS;
      this.stallRecoveryAttempts = 0;
    } else {
      this.playbackStallBackoffUntilMs = Date.now() + PLAYBACK_STALL_RETRY_BACKOFF_MS;
      if (this.stallRecoveryAttempts >= 6) {
        this.deps.onToast("Playback is stuck right now. Try starting a new session.", 4000);
      }
    }

    this.stallRecoveryInFlight = false;
  }
}
