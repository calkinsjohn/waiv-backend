import type { PlaybackTrack } from "./types";
import { TrackValidationService } from "./trackValidationService";

type QueuePools = {
  primary: PlaybackTrack[];
  suggestions: PlaybackTrack[];
};

function shuffle<T>(items: T[], random: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export class QueueManager {
  private readonly validation: TrackValidationService;
  private readonly random: () => number;
  private pools: QueuePools = { primary: [], suggestions: [] };
  private validatedQueue: PlaybackTrack[] = [];
  private playedIds = new Set<string>();
  private queuedIds = new Set<string>();
  private primaryCursor = 0;
  private suggestionCursor = 0;

  constructor(input: { validationService: TrackValidationService; random?: () => number }) {
    this.validation = input.validationService;
    this.random = input.random ?? Math.random;
  }

  seed(input: { primary: PlaybackTrack[]; suggestions: PlaybackTrack[] }): void {
    this.pools = {
      primary: shuffle(input.primary, this.random),
      suggestions: shuffle(input.suggestions, this.random),
    };
    this.validatedQueue = [];
    this.playedIds.clear();
    this.queuedIds.clear();
    this.primaryCursor = 0;
    this.suggestionCursor = 0;
  }

  markPlayed(trackId: string): void {
    this.playedIds.add(trackId);
    this.queuedIds.delete(trackId);
  }

  async ensureBuffer(input: {
    minBuffered: number;
    targetBuffered: number;
    contextLabel: string;
    onValidation?: (event: {
      type: "success" | "failure";
      track: PlaybackTrack;
      reason?: string;
    }) => void;
  }): Promise<void> {
    if (this.validatedQueue.length >= input.minBuffered) {
      return;
    }

    let safety = 0;
    while (this.validatedQueue.length < input.targetBuffered && safety < 12) {
      safety += 1;
      const batch = this.takeCandidateBatch(10);
      if (batch.length === 0) {
        break;
      }

      const validation = await this.validation.validateTracks(batch, {
        strict: false,
        validateLeadingCount: Math.min(5, batch.length),
        contextLabel: input.contextLabel,
      });

      for (const track of validation.playable) {
        if (this.playedIds.has(track.id) || this.queuedIds.has(track.id)) {
          continue;
        }
        this.validatedQueue.push(track);
        this.queuedIds.add(track.id);
        input.onValidation?.({ type: "success", track });
      }

      for (const failure of validation.failures) {
        input.onValidation?.({
          type: "failure",
          track: failure.track,
          reason: failure.reason,
        });
      }
    }
  }

  dequeueNext(): PlaybackTrack | null {
    const next = this.validatedQueue.shift() ?? null;
    if (!next) {
      return null;
    }
    this.queuedIds.delete(next.id);
    return next;
  }

  getBufferedCount(): number {
    return this.validatedQueue.length;
  }

  private takeCandidateBatch(limit: number): PlaybackTrack[] {
    const picks: PlaybackTrack[] = [];

    while (picks.length < limit) {
      const shouldPickSuggestion =
        this.suggestionCursor < this.pools.suggestions.length &&
        this.random() < 0.3;

      const candidate = shouldPickSuggestion
        ? this.pools.suggestions[this.suggestionCursor++]
        : this.pools.primary[this.primaryCursor++] ?? this.pools.suggestions[this.suggestionCursor++];

      if (!candidate) {
        break;
      }
      if (this.playedIds.has(candidate.id) || this.queuedIds.has(candidate.id)) {
        continue;
      }
      picks.push(candidate);
    }

    return picks;
  }
}
