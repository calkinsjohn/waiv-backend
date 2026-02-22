import { describe, expect, it } from "vitest";
import { isSoundtrackOrScoreLike } from "./mediaContentFilter";

describe("isSoundtrackOrScoreLike", () => {
  it("flags film soundtrack album markers", () => {
    expect(
      isSoundtrackOrScoreLike({
        title: "Main Theme",
        artistName: "Hans Zimmer",
        albumTitle: "Interstellar (Original Motion Picture Soundtrack)",
        genreTag: "Soundtrack",
      })
    ).toBe(true);
  });

  it("flags video game soundtrack metadata", () => {
    expect(
      isSoundtrackOrScoreLike({
        title: "City Escape",
        artistName: "SEGA Sound Team",
        albumTitle: "Sonic Adventure 2 Original Game Soundtrack",
        genreTag: "Video Game",
      })
    ).toBe(true);
  });

  it("flags score cue naming patterns", () => {
    expect(
      isSoundtrackOrScoreLike({
        title: "End Credits",
        artistName: "Original Score",
        albumTitle: "The Last of Us Part II",
        genreTag: "Score",
      })
    ).toBe(true);
  });

  it("does not block normal artist catalog tracks", () => {
    expect(
      isSoundtrackOrScoreLike({
        title: "Karma Police",
        artistName: "Radiohead",
        albumTitle: "OK Computer",
        genreTag: "Alternative",
      })
    ).toBe(false);
  });

  it("does not block non-media songs that contain the word soundtrack in title", () => {
    expect(
      isSoundtrackOrScoreLike({
        title: "Soundtrack 2 My Life",
        artistName: "Kid Cudi",
        albumTitle: "Man on the Moon: The End of Day",
        genreTag: "Hip-Hop/Rap",
      })
    ).toBe(false);
  });
});
