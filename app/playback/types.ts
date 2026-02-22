export type QueueSourceTier = "heavyRotation" | "favorites" | "library" | "suggestion";

export type PlaybackTrackSource = "library" | "suggestion";

export type PlaybackTrack = {
  id: string;
  title: string;
  artistName: string;
  source: PlaybackTrackSource;
  genreTag?: string | null;
  albumId?: string | null;
  albumTitle?: string | null;
};

export type TrackValidationFailureReason =
  | "unplayable"
  | "validation_error"
  | "startup_timeout"
  | "playback_start_failed"
  | "ambient_filtered";

export type TrackValidationResult = {
  playable: PlaybackTrack[];
  failures: Array<{
    track: PlaybackTrack;
    reason: TrackValidationFailureReason;
  }>;
};

export type PlayerState =
  | "idle"
  | "preparing"
  | "starting_track"
  | "playing"
  | "paused"
  | "buffering"
  | "failed";

export type PlaybackTelemetryEvent = {
  name: string;
  payload: Record<string, unknown>;
};

export type SessionStartResult = {
  ok: boolean;
  sessionId: string | null;
  firstTrack: PlaybackTrack | null;
  firstTrackSource: "heavy_rotation" | "favorites" | "library" | "none";
  error?: string;
};
