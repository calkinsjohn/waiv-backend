import { describe, expect, it } from "vitest";

import {
  buildSessionIntroBlueprintForTest,
  type SessionIntroRequest,
} from "./pipeline";

function makeRequest(overrides: Partial<SessionIntroRequest>): SessionIntroRequest {
  return {
    djID: "casey",
    introKind: "standard",
    firstTrack: {
      title: "Yellow",
      artist: "Coldplay",
      isrc: "GBAYE0000001",
    },
    listenerContext: {
      localTimestamp: "2026-03-12T22:00:00-04:00",
      timeZoneIdentifier: "America/Indiana/Indianapolis",
      weekday: "Thursday",
      month: "March",
      dayOfMonth: 12,
      year: 2026,
      hour24: 22,
      timeOfDay: "night",
    },
    showContext: {
      djId: "casey",
      sessionType: "fresh_start",
      timeContext: {
        timeOfDay: "night",
        dayOfWeek: "thursday",
        isWeekend: false,
        label: "Thursday night",
      },
      setContext: {
        openingTrackRole: "confident_opener",
        openingTrackMood: ["intentional", "steady"],
        openingTrackEnergy: 0.56,
        openingTrackTexture: ["familiar", "curated"],
        openingTrackFamiliarity: "moderately_familiar",
        openingTrackDiscoveryMode: "bridge_between_known_and_new",
      },
      listenerContext: {
        isFirstSessionToday: false,
        returningAfterGap: false,
        changedDjsRecently: false,
        skipsIntrosOften: false,
      },
      environmentContext: {
        season: "spring",
        weatherVibe: null,
        localeVibe: null,
      },
      recentHistory: {
        recentArchetypes: [],
        recentOpeningStructures: [],
        recentOpeningPhrases: [],
        recentSentenceCounts: [],
        recentHandoffStyles: [],
        recentVocabulary: [],
        recentEmotionalTones: [],
        recentOpeningStyles: [],
        recentLengths: [],
        recentStationStyles: [],
        usedTimeReferenceRecently: false,
        usedAISelfAwarenessRecently: false,
      },
    },
    ...overrides,
  };
}

describe("session-intro decision fixtures", () => {
  it("biases Marcus toward a short, in-motion open for energetic exploratory nights", () => {
    const blueprint = buildSessionIntroBlueprintForTest(
      makeRequest({
        djID: "marcus",
        firstTrack: {
          title: "Midnight City",
          artist: "M83",
          isrc: "USQX91500866",
        },
        showContext: {
          ...makeRequest({}).showContext!,
          djId: "marcus",
          setContext: {
            openingTrackRole: "bold_opener",
            openingTrackMood: ["alive", "forward"],
            openingTrackEnergy: 0.82,
            openingTrackTexture: ["discovery", "night_drive"],
            openingTrackFamiliarity: "exploratory",
            openingTrackDiscoveryMode: "bold_discovery",
          },
        },
      })
    );

    expect(blueprint.length).toBe("short");
    expect(blueprint.openingStyle).toBe("in_motion");
  });

  it("gives Luna more air for reflective familiar openings", () => {
    const blueprint = buildSessionIntroBlueprintForTest(
      makeRequest({
        djID: "luna",
        firstTrack: {
          title: "Reckoner",
          artist: "Radiohead",
          isrc: "USCA21504635",
        },
        showContext: {
          ...makeRequest({}).showContext!,
          djId: "luna",
          timeContext: {
            timeOfDay: "night",
            dayOfWeek: "sunday",
            isWeekend: true,
            label: "Sunday night",
          },
          setContext: {
            openingTrackRole: "intimate_low_key_open",
            openingTrackMood: ["close", "soft"],
            openingTrackEnergy: 0.28,
            openingTrackTexture: ["familiar", "textured"],
            openingTrackFamiliarity: "highly_familiar",
            openingTrackDiscoveryMode: "comfort_reset",
          },
        },
      })
    );

    expect(blueprint.openingStyle).toBe("atmospheric");
    expect(["medium", "long"]).toContain(blueprint.length);
  });

  it("keeps April from repeating the same station call when recent history used WAIV", () => {
    const blueprint = buildSessionIntroBlueprintForTest(
      makeRequest({
        showContext: {
          ...makeRequest({}).showContext!,
          recentHistory: {
            ...makeRequest({}).showContext!.recentHistory,
            recentStationStyles: ["WAIV"],
            recentOpeningStyles: ["direct"],
            recentLengths: ["medium"],
          },
        },
      })
    );

    expect(blueprint.stationStyle).not.toBe("WAIV");
  });
});
