import { describe, expect, it } from "vitest";
import {
  selectOpeningTrackByPriority,
  type TuneInOpeningTrackBuckets,
} from "./tuneInOpeningTrackSelector";

function buckets(partial?: Partial<TuneInOpeningTrackBuckets>): TuneInOpeningTrackBuckets {
  return {
    heavyRotation: [],
    mostPlayed: [],
    favorites: [],
    recentlyPlayed: [],
    suggestionFallback: [],
    ...partial,
  };
}

describe("selectOpeningTrackByPriority", () => {
  it("always picks heavy rotation first when playable", () => {
    const selection = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          { id: "heavy_1", title: "A", artistName: "Artist A", source: "library" },
        ],
        mostPlayed: [
          { id: "most_1", title: "B", artistName: "Artist B", source: "library" },
        ],
      }),
      isPlayable: () => true,
    });

    expect(selection?.source).toBe("heavy_rotation");
    expect(selection?.track.id).toBe("heavy_1");
  });

  it("picks the first playable song within heavy rotation order", () => {
    const selection = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          { id: "heavy_1", title: "A", artistName: "Artist A", source: "library" },
          { id: "heavy_2", title: "B", artistName: "Artist B", source: "library" },
        ],
        mostPlayed: [
          { id: "most_1", title: "C", artistName: "Artist C", source: "library" },
        ],
      }),
      isPlayable: (id) => id === "heavy_2" || id === "most_1",
    });

    expect(selection?.source).toBe("heavy_rotation");
    expect(selection?.track.id).toBe("heavy_2");
  });

  it("falls back to most played when heavy rotation has no playable tracks", () => {
    const selection = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          { id: "heavy_1", title: "A", artistName: "Artist A", source: "library" },
        ],
        mostPlayed: [
          { id: "most_1", title: "B", artistName: "Artist B", source: "library" },
        ],
      }),
      isPlayable: (id) => id === "most_1",
    });

    expect(selection?.source).toBe("most_played");
    expect(selection?.track.id).toBe("most_1");
  });

  it("falls back through favorites then recently played", () => {
    const selection = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          { id: "heavy_1", title: "A", artistName: "Artist A", source: "library" },
        ],
        mostPlayed: [
          { id: "most_1", title: "B", artistName: "Artist B", source: "library" },
        ],
        favorites: [
          { id: "fav_1", title: "C", artistName: "Artist C", source: "library" },
        ],
        recentlyPlayed: [
          { id: "recent_1", title: "D", artistName: "Artist D", source: "library" },
        ],
      }),
      isPlayable: (id) => id === "fav_1",
    });

    expect(selection?.source).toBe("favorites");
    expect(selection?.track.id).toBe("fav_1");
  });

  it("uses suggestion fallback only when higher-priority buckets fail", () => {
    const selection = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          { id: "heavy_1", title: "A", artistName: "Artist A", source: "library" },
        ],
        mostPlayed: [
          { id: "most_1", title: "B", artistName: "Artist B", source: "library" },
        ],
        favorites: [
          { id: "fav_1", title: "C", artistName: "Artist C", source: "library" },
        ],
        recentlyPlayed: [
          { id: "recent_1", title: "D", artistName: "Artist D", source: "library" },
        ],
        suggestionFallback: [
          {
            id: "suggest_1",
            title: "S",
            artistName: "Artist S",
            source: "suggestion",
          },
        ],
      }),
      isPlayable: (id) => id === "suggest_1",
    });

    expect(selection?.source).toBe("suggestion_fallback");
    expect(selection?.track.id).toBe("suggest_1");
  });

  it("returns null when nothing is playable", () => {
    const selection = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [{ id: "h1", title: "A", artistName: "A", source: "library" }],
      }),
      isPlayable: () => false,
    });

    expect(selection).toBeNull();
  });

  it("rerolls when previous session used the same opening track and alternatives exist", () => {
    const selection = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          { id: "heavy_1", title: "A", artistName: "Artist A", source: "library" },
          { id: "heavy_2", title: "B", artistName: "Artist B", source: "library" },
        ],
      }),
      isPlayable: () => true,
      selectionPolicy: {
        previousSessionFirstTrackId: "heavy_1",
        random: () => 0,
      },
    });

    expect(selection?.source).toBe("heavy_rotation");
    expect(selection?.track.id).toBe("heavy_2");
  });

  it("rerolls when previous opener has different ID but same canonical song key", () => {
    const selection = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          {
            id: "heavy_live",
            title: "1979 (Remastered 2012)",
            artistName: "The Smashing Pumpkins",
            source: "library",
          },
          {
            id: "heavy_alt",
            title: "Tonight, Tonight",
            artistName: "The Smashing Pumpkins",
            source: "library",
          },
        ],
      }),
      isPlayable: () => true,
      selectionPolicy: {
        previousSessionFirstTrackId: "different_id",
        previousSessionFirstTrackKey: "1979::the smashing pumpkins",
        random: () => 0,
      },
    });

    expect(selection?.track.id).toBe("heavy_alt");
  });

  it("forces reroll when an opening track appears more than once in the last five sessions", () => {
    const selection = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          { id: "heavy_1", title: "A", artistName: "Artist A", source: "library" },
          { id: "heavy_2", title: "B", artistName: "Artist B", source: "library" },
          { id: "heavy_3", title: "C", artistName: "Artist C", source: "library" },
        ],
      }),
      isPlayable: () => true,
      selectionPolicy: {
        recentFirstTrackIds: ["heavy_1", "heavy_1", "x", "y", "z"],
        random: () => 0,
      },
    });

    expect(selection?.source).toBe("heavy_rotation");
    expect(selection?.track.id).not.toBe("heavy_1");
  });

  it("avoids any recently used opening key when alternatives exist", () => {
    const selection = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          {
            id: "heavy_live",
            title: "1979 (Remastered 2012)",
            artistName: "The Smashing Pumpkins",
            source: "library",
          },
          {
            id: "heavy_alt",
            title: "Tonight, Tonight",
            artistName: "The Smashing Pumpkins",
            source: "library",
          },
        ],
      }),
      isPlayable: () => true,
      selectionPolicy: {
        recentFirstTrackKeys: ["1979::the smashing pumpkins"],
        random: () => 0,
      },
    });

    expect(selection?.track.id).toBe("heavy_alt");
  });

  it("allows repeat only when no alternative opening track exists", () => {
    const selection = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          { id: "heavy_1", title: "A", artistName: "Artist A", source: "library" },
        ],
      }),
      isPlayable: () => true,
      selectionPolicy: {
        previousSessionFirstTrackId: "heavy_1",
        recentFirstTrackIds: ["heavy_1", "heavy_1", "heavy_1"],
      },
    });

    expect(selection?.source).toBe("heavy_rotation");
    expect(selection?.track.id).toBe("heavy_1");
  });

  it("supports different user histories yielding different openers from same heavy rotation pool", () => {
    const userA = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          { id: "heavy_1", title: "A", artistName: "Artist A", source: "library" },
          { id: "heavy_2", title: "B", artistName: "Artist B", source: "library" },
        ],
      }),
      isPlayable: () => true,
      selectionPolicy: {
        previousSessionFirstTrackId: "heavy_1",
        random: () => 0,
      },
    });
    const userB = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          { id: "heavy_1", title: "A", artistName: "Artist A", source: "library" },
          { id: "heavy_2", title: "B", artistName: "Artist B", source: "library" },
        ],
      }),
      isPlayable: () => true,
      selectionPolicy: {
        previousSessionFirstTrackId: "heavy_2",
        random: () => 0,
      },
    });

    expect(userA?.track.id).toBe("heavy_2");
    expect(userB?.track.id).toBe("heavy_1");
  });

  it("handles back-to-back sessions across different DJs without reusing previous opener when alternatives exist", () => {
    const djOneSession = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          { id: "h1", title: "Song 1", artistName: "Artist 1", source: "library" },
          { id: "h2", title: "Song 2", artistName: "Artist 2", source: "library" },
        ],
      }),
      isPlayable: () => true,
      selectionPolicy: {
        random: () => 0,
      },
    });
    const djTwoSession = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          { id: "h1", title: "Song 1", artistName: "Artist 1", source: "library" },
          { id: "h2", title: "Song 2", artistName: "Artist 2", source: "library" },
        ],
      }),
      isPlayable: () => true,
      selectionPolicy: {
        previousSessionFirstTrackId: djOneSession?.track.id ?? null,
        random: () => 0,
      },
    });

    expect(djOneSession?.track.id).toBe("h1");
    expect(djTwoSession?.track.id).toBe("h2");
  });

  it("rerolls repeated opener patterns across consecutive sessions", () => {
    const heavy = [
      { id: "h1", title: "Song 1", artistName: "Artist 1", source: "library" as const },
      { id: "h2", title: "Song 2", artistName: "Artist 2", source: "library" as const },
      { id: "h3", title: "Song 3", artistName: "Artist 3", source: "library" as const },
    ];

    const session1 = selectOpeningTrackByPriority({
      buckets: buckets({ heavyRotation: heavy }),
      isPlayable: () => true,
      selectionPolicy: { random: () => 0 },
    });
    const session2 = selectOpeningTrackByPriority({
      buckets: buckets({ heavyRotation: heavy }),
      isPlayable: () => true,
      selectionPolicy: {
        previousSessionFirstTrackId: session1?.track.id ?? null,
        random: () => 0,
      },
    });
    const session3 = selectOpeningTrackByPriority({
      buckets: buckets({ heavyRotation: heavy }),
      isPlayable: () => true,
      selectionPolicy: {
        previousSessionFirstTrackId: session2?.track.id ?? null,
        recentFirstTrackIds: [session1?.track.id ?? "", session2?.track.id ?? "", "h1", "x", "y"],
        random: () => 0,
      },
    });

    expect(session1?.track.id).toBe("h1");
    expect(session2?.track.id).not.toBe("h1");
    expect(session3?.track.id).not.toBe("h1");
  });

  it("cold start and warm start can produce different first tracks when history is available", () => {
    const coldStart = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          { id: "h1", title: "Song 1", artistName: "Artist 1", source: "library" },
          { id: "h2", title: "Song 2", artistName: "Artist 2", source: "library" },
        ],
      }),
      isPlayable: () => true,
      selectionPolicy: {
        random: () => 0,
      },
    });

    const warmStart = selectOpeningTrackByPriority({
      buckets: buckets({
        heavyRotation: [
          { id: "h1", title: "Song 1", artistName: "Artist 1", source: "library" },
          { id: "h2", title: "Song 2", artistName: "Artist 2", source: "library" },
        ],
      }),
      isPlayable: () => true,
      selectionPolicy: {
        previousSessionFirstTrackId: coldStart?.track.id ?? null,
        recentFirstTrackIds: [coldStart?.track.id ?? ""],
        random: () => 0,
      },
    });

    expect(coldStart?.track.id).toBe("h1");
    expect(warmStart?.track.id).toBe("h2");
  });
});
