import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureAppleMusicPlayback: vi.fn(),
  getAppleMusicNowPlaying: vi.fn(),
  pauseAppleMusicPlayback: vi.fn(),
  queueAppleMusicTrackIds: vi.fn(),
  skipAppleMusicToNext: vi.fn(),
}));

vi.mock("../appleMusicClient", () => ({
  ensureAppleMusicPlayback: mocks.ensureAppleMusicPlayback,
  getAppleMusicNowPlaying: mocks.getAppleMusicNowPlaying,
  pauseAppleMusicPlayback: mocks.pauseAppleMusicPlayback,
  primeAppleMusicPlaybackHead: vi.fn(),
  prepareAppleMusicTuneInSession: vi.fn(),
  queueAppleMusicTrackIds: mocks.queueAppleMusicTrackIds,
  skipAppleMusicToNext: mocks.skipAppleMusicToNext,
  toggleAppleMusicPlayback: vi.fn(),
  getAppleMusicVolume: vi.fn().mockResolvedValue(1),
  setAppleMusicVolume: vi.fn().mockResolvedValue(undefined),
}));

import { WaivPlaybackController } from "./waivPlaybackController";

describe("WaivPlaybackController intro gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureAppleMusicPlayback.mockResolvedValue(true);
    mocks.getAppleMusicNowPlaying.mockResolvedValue({
      id: "track-1",
      title: "Track One",
      artistName: "Artist One",
      artworkUrl: null,
      progress: 0,
      isPlaying: false,
    });
    mocks.skipAppleMusicToNext.mockResolvedValue(undefined);
  });

  it("does not trigger stall recovery while session intro is still in progress", async () => {
    const controller = new WaivPlaybackController({
      onToast: vi.fn(),
      onTelemetry: vi.fn(),
    });
    const anyController = controller as unknown as {
      sessionId: string | null;
      activeDj: { id: string; name: string } | null;
      sessionIntroInFlight: boolean;
      allowTrackIntros: boolean;
      lastObservedProgress: number;
      lastObservedProgressAtMs: number | null;
      lastObservedProgressTrackId: string | null;
      playbackStallTrackId: string | null;
      playbackStallSinceMs: number | null;
      stallRecoveryInFlight: boolean;
      state: { transition: (next: string, reason?: string) => void };
      recoverFromUnavailableTrack: (trackId: string) => Promise<void>;
      pollNowPlaying: () => Promise<void>;
    };

    const recoverSpy = vi
      .spyOn(anyController, "recoverFromUnavailableTrack")
      .mockResolvedValue(undefined);

    anyController.sessionId = "session-1";
    anyController.activeDj = { id: "casey", name: "Casey" };
    anyController.sessionIntroInFlight = true;
    anyController.allowTrackIntros = true;
    anyController.playbackStallTrackId = "track-1";
    anyController.playbackStallSinceMs = Date.now() - 7000;
    anyController.stallRecoveryInFlight = false;
    anyController.state.transition("starting_track", "playing_intro");

    await anyController.pollNowPlaying();

    expect(recoverSpy).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("allows stall recovery once the player state is playing", async () => {
    const controller = new WaivPlaybackController({
      onToast: vi.fn(),
      onTelemetry: vi.fn(),
    });
    const anyController = controller as unknown as {
      sessionId: string | null;
      activeDj: { id: string; name: string } | null;
      sessionIntroInFlight: boolean;
      allowTrackIntros: boolean;
      playbackStallTrackId: string | null;
      playbackStallSinceMs: number | null;
      stallRecoveryInFlight: boolean;
      state: { transition: (next: string, reason?: string) => void };
      recoverFromUnavailableTrack: (trackId: string) => Promise<void>;
      pollNowPlaying: () => Promise<void>;
    };

    const recoverSpy = vi
      .spyOn(anyController, "recoverFromUnavailableTrack")
      .mockResolvedValue(undefined);

    anyController.sessionId = "session-1";
    anyController.activeDj = { id: "casey", name: "Casey" };
    anyController.sessionIntroInFlight = false;
    anyController.allowTrackIntros = true;
    anyController.lastObservedProgressTrackId = "track-1";
    anyController.lastObservedProgress = 0;
    anyController.lastObservedProgressAtMs = Date.now() - 7000;
    anyController.playbackStallTrackId = "track-1";
    anyController.playbackStallSinceMs = Date.now() - 7000;
    anyController.stallRecoveryInFlight = false;
    anyController.state.transition("playing", "session_started");

    await anyController.pollNowPlaying();

    expect(recoverSpy).toHaveBeenCalledWith("track-1");
    controller.dispose();
  });

  it("allows stall recovery while buffering once track intros are enabled", async () => {
    const controller = new WaivPlaybackController({
      onToast: vi.fn(),
      onTelemetry: vi.fn(),
    });
    const anyController = controller as unknown as {
      sessionId: string | null;
      activeDj: { id: string; name: string } | null;
      sessionIntroInFlight: boolean;
      allowTrackIntros: boolean;
      lastObservedProgress: number;
      lastObservedProgressAtMs: number | null;
      lastObservedProgressTrackId: string | null;
      playbackStallTrackId: string | null;
      playbackStallSinceMs: number | null;
      stallRecoveryInFlight: boolean;
      state: { transition: (next: string, reason?: string) => void };
      recoverFromUnavailableTrack: (trackId: string) => Promise<void>;
      pollNowPlaying: () => Promise<void>;
    };

    const recoverSpy = vi
      .spyOn(anyController, "recoverFromUnavailableTrack")
      .mockResolvedValue(undefined);

    anyController.sessionId = "session-1";
    anyController.activeDj = { id: "casey", name: "Casey" };
    anyController.sessionIntroInFlight = false;
    anyController.allowTrackIntros = true;
    anyController.lastObservedProgressTrackId = "track-1";
    anyController.lastObservedProgress = 0;
    anyController.lastObservedProgressAtMs = Date.now() - 7000;
    anyController.playbackStallTrackId = "track-1";
    anyController.playbackStallSinceMs = Date.now() - 7000;
    anyController.stallRecoveryInFlight = false;
    anyController.state.transition("buffering", "poll_now_playing");

    await anyController.pollNowPlaying();

    expect(recoverSpy).toHaveBeenCalledWith("track-1");
    controller.dispose();
  });

  it("does not trigger stall recovery while session intro audio is in-flight", async () => {
    const controller = new WaivPlaybackController({
      onToast: vi.fn(),
      onTelemetry: vi.fn(),
    });
    const anyController = controller as unknown as {
      sessionId: string | null;
      activeDj: { id: string; name: string } | null;
      sessionIntroInFlight: boolean;
      playbackStallTrackId: string | null;
      playbackStallSinceMs: number | null;
      stallRecoveryInFlight: boolean;
      state: { transition: (next: string, reason?: string) => void };
      recoverFromUnavailableTrack: (trackId: string) => Promise<void>;
      pollNowPlaying: () => Promise<void>;
    };

    const recoverSpy = vi
      .spyOn(anyController, "recoverFromUnavailableTrack")
      .mockResolvedValue(undefined);

    anyController.sessionId = "session-1";
    anyController.activeDj = { id: "casey", name: "Casey" };
    anyController.sessionIntroInFlight = true;
    anyController.playbackStallTrackId = "track-1";
    anyController.playbackStallSinceMs = Date.now() - 7000;
    anyController.stallRecoveryInFlight = false;
    anyController.state.transition("buffering", "poll_now_playing");

    await anyController.pollNowPlaying();

    expect(recoverSpy).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("preserves stall timeline when recovery fails", async () => {
    const controller = new WaivPlaybackController({
      onToast: vi.fn(),
      onTelemetry: vi.fn(),
    });
    const anyController = controller as unknown as {
      playbackStallTrackId: string | null;
      playbackStallSinceMs: number | null;
      stallRecoveryAttempts: number;
      playbackStallBackoffUntilMs: number | null;
      recoverFromUnavailableTrack: (trackId: string) => Promise<void>;
    };

    anyController.playbackStallTrackId = "track-1";
    anyController.playbackStallSinceMs = Date.now() - 7000;
    anyController.stallRecoveryAttempts = 2;
    anyController.playbackStallBackoffUntilMs = null;
    mocks.skipAppleMusicToNext.mockResolvedValue(undefined);
    mocks.ensureAppleMusicPlayback.mockResolvedValue(false);

    await anyController.recoverFromUnavailableTrack("track-1");

    expect(anyController.playbackStallTrackId).toBe("track-1");
    expect(anyController.playbackStallSinceMs).not.toBeNull();
    expect(anyController.stallRecoveryAttempts).toBe(3);
    expect(anyController.playbackStallBackoffUntilMs).not.toBeNull();
    controller.dispose();
  });

  it("treats Marcus as intro-enabled and builds a populated intro script", async () => {
    const controller = new WaivPlaybackController({
      onToast: vi.fn(),
      onTelemetry: vi.fn(),
    });
    const anyController = controller as unknown as {
      hasSessionIntroLibrary: (djId: string | null) => boolean;
      buildSessionIntroScript: (
        dj: { id: string; name: string },
        track: {
          id: string;
          title: string;
          artistName: string;
          source: "library" | "suggestion";
          genreTag: string | null;
          albumId: string | null;
          albumTitle: string | null;
        }
      ) => { introId: string; script: string };
    };

    expect(anyController.hasSessionIntroLibrary("marcus")).toBe(true);

    const intro = await anyController.buildSessionIntroScript(
      { id: "marcus", name: "Marcus, the neighborhood tastemaker" },
      {
        id: "track-1",
        title: "Test Song (Live)",
        artistName: "Test Artist",
        source: "library",
        genreTag: null,
        albumId: null,
        albumTitle: null,
      }
    );

    expect(intro.introId.startsWith("marcus_")).toBe(true);
    expect(intro.script.includes("[SONG TITLE]")).toBe(false);
    expect(intro.script.includes("[ARTIST]")).toBe(false);
    expect(intro.script).toContain("Test Song");
    expect(intro.script).toContain("Test Artist");

    controller.dispose();
  });
});
