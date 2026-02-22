import { describe, expect, it } from "vitest";
import { QueueManager } from "./queueManager";
import type { PlaybackTrack } from "./types";

class FakeValidationService {
  async validateTracks(tracks: PlaybackTrack[]) {
    return {
      playable: tracks.filter((track) => !track.title.toLowerCase().includes("fail")),
      failures: tracks
        .filter((track) => track.title.toLowerCase().includes("fail"))
        .map((track) => ({
          track,
          reason: "unplayable" as const,
        })),
    };
  }
}

function track(id: string, title: string, source: "library" | "suggestion" = "library"): PlaybackTrack {
  return {
    id,
    title,
    artistName: `Artist ${id}`,
    source,
  };
}

describe("QueueManager", () => {
  it("buffers validated tracks and excludes failures", async () => {
    const manager = new QueueManager({
      validationService: new FakeValidationService() as never,
      random: () => 0,
    });

    manager.seed({
      primary: [track("1", "A"), track("2", "Fail track"), track("3", "B")],
      suggestions: [track("4", "S", "suggestion")],
    });

    await manager.ensureBuffer({
      minBuffered: 1,
      targetBuffered: 4,
      contextLabel: "test",
    });

    const queued: string[] = [];
    let next = manager.dequeueNext();
    while (next) {
      queued.push(next.id);
      manager.markPlayed(next.id);
      next = manager.dequeueNext();
    }

    expect(queued).toContain("1");
    expect(queued).toContain("3");
    expect(queued).toContain("4");
    expect(queued).not.toContain("2");
  });
});
