import type { PlayerState } from "./types";

export type PlayerStateSnapshot = {
  state: PlayerState;
  sessionId: string | null;
  reason: string | null;
};

export class PlayerStateMachine {
  private snapshot: PlayerStateSnapshot = {
    state: "idle",
    sessionId: null,
    reason: null,
  };

  getSnapshot(): PlayerStateSnapshot {
    return this.snapshot;
  }

  beginSession(sessionId: string): void {
    this.snapshot = {
      state: "preparing",
      sessionId,
      reason: null,
    };
  }

  transition(next: PlayerState, reason?: string): void {
    this.snapshot = {
      ...this.snapshot,
      state: next,
      reason: reason ?? null,
    };
  }

  fail(reason: string): void {
    this.snapshot = {
      ...this.snapshot,
      state: "failed",
      reason,
    };
  }

  reset(): void {
    this.snapshot = {
      state: "idle",
      sessionId: null,
      reason: null,
    };
  }
}
