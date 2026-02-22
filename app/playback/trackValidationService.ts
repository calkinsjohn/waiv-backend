import { filterPlayableAppleMusicTrackIds } from "../appleMusicClient";
import type { PlaybackTrack, TrackValidationResult } from "./types";

export class TrackValidationService {
  async validateTracks(
    tracks: PlaybackTrack[],
    options?: {
      strict?: boolean;
      contextLabel?: string;
      validateLeadingCount?: number;
    }
  ): Promise<TrackValidationResult> {
    if (tracks.length === 0) {
      return {
        playable: [],
        failures: [],
      };
    }

    try {
      const availability = await filterPlayableAppleMusicTrackIds(
        tracks.map((track) => track.id),
        {
          // Strict catalog-only validation can incorrectly reject library-only IDs.
          // Keep validation permissive and let startup guardrails fail fast if needed.
          strict: options?.strict ?? false,
          validateLeadingCount: options?.validateLeadingCount ?? Math.min(5, tracks.length),
          contextLabel: options?.contextLabel ?? "waiv_track_validate",
        }
      );

      const playableSet = new Set(availability.playableTrackIds);
      const unavailableSet = new Set(availability.unavailableTrackIds);

      return {
        playable: tracks.filter((track) => playableSet.has(track.id)),
        failures: tracks
          .filter((track) => !playableSet.has(track.id))
          .map((track) => ({
            track,
            reason: unavailableSet.has(track.id)
              ? ("unplayable" as const)
              : ("validation_error" as const),
          })),
      };
    } catch {
      return {
        playable: [],
        failures: tracks.map((track) => ({
          track,
          reason: "validation_error" as const,
        })),
      };
    }
  }
}
