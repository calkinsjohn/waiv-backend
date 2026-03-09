import { describe, expect, it } from "vitest";
import {
  isAmbientLike,
  sanitizeSpokenArtist,
  sanitizeSpokenText,
  sanitizeSpokenTitle,
  spokenTitle,
} from "./sanitization";

describe("spokenTitle", () => {
  it("removes parenthetical and version suffixes", () => {
    expect(spokenTitle("1979 (Remastered 2012) - Live")).toBe("1979");
    expect(spokenTitle("Song Name (feat. Artist) - Radio Edit")).toBe("Song Name");
  });
});

describe("sanitizeSpokenText", () => {
  it("replaces unsafe terms", () => {
    expect(sanitizeSpokenText("this is fucking wild")).toBe("this is — wild");
    expect(sanitizeSpokenArtist("Damn Band")).toBe("— Band");
  });

  it("keeps safe fallbacks", () => {
    expect(sanitizeSpokenTitle("(Live) - Remastered")).toBe("this track");
  });
});

describe("isAmbientLike", () => {
  it("filters ambient metadata", () => {
    expect(
      isAmbientLike({
        title: "Night Drift",
        genreTag: "Ambient",
      })
    ).toBe(true);
    expect(
      isAmbientLike({
        title: "Karma Police",
        genreTag: "Alternative",
      })
    ).toBe(false);
  });

  it("filters chillhop and lo-fi beat metadata", () => {
    expect(
      isAmbientLike({
        title: "Night Drift",
        genreTag: "Chillhop",
      })
    ).toBe(true);
    expect(
      isAmbientLike({
        title: "Rainy Window",
        albumTitle: "Lo-Fi Beats to Study To",
        genreTag: "Hip-Hop/Rap",
      })
    ).toBe(true);
  });
});
