"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { clearAppleMusicSession, hasAppleMusicSession, subscribeAppleMusicSession } from "./appleMusicSession";
import { recordTrackPlay, registerListeningSession } from "./listeningHistoryStore";
import { type AppleMusicNowPlaying, getAppleMusicAuthorizationState } from "./appleMusicClient";
import { AppToast, type AppToastState } from "./components/AppToast";
import { FirstTimeHomeOnboardingModal } from "./components/FirstTimeHomeOnboardingModal";
import { WaivPlaybackController } from "./playback/waivPlaybackController";
import { buildCanonicalTrackKey } from "./trackIdentity";

const imgDjMiles = "/images/miles_640.webp";
const imgDjLuna = "/images/luna_640.webp";
const imgDjCasey = "/images/casey_640.webp";
const imgDjJolene = "/images/jolene_640.webp";
const imgDjMarcus = "/images/marcus_640.webp";
const TRACK_ART_FALLBACK_SRC = "/images/album_placeholder.webp";

const TRANSFORM_MS = 820;
const OPACITY_MS = 700;
const DJ_TEXT_IDLE_FADE_MS = 8000;
const DJ_TEXT_FADE_DURATION_MS = 850;
const SIDE_DJ_SCALE = 0.72;
const SIDE_DJ_CLEAR_GAP_PX = 14;
const DJ_RAIL_SWIPE_THRESHOLD_PX = 52;
const DJ_RAIL_VERTICAL_GUARD_PX = 38;
const HOME_ONBOARDING_SEEN_KEY = "waiv.has_seen_home_onboarding_v1";
const LEGACY_HOME_ONBOARDING_SEEN_KEY = "airwaves.has_seen_home_onboarding_v1";

type DJ = {
  id: string;
  name: string;
  description: string;
  portraitSrc: string;
};

type TuneInTrackSource = "library" | "suggestion";

type ControllerNowPlaying = {
  id: string;
  title: string;
  artistName: string;
  albumId?: string | null;
  albumTitle?: string | null;
  artworkUrl: string | null;
  progress: number;
  isPlaying: boolean;
};

const DJS: DJ[] = [
  {
    id: "casey",
    name: "Casey, the millennial throwback",
    description:
      "Dry-witted former college radio host curating smart nostalgia and future favorites.",
    portraitSrc: imgDjCasey,
  },
  {
    id: "marcus",
    name: "Marcus, the neighborhood tastemaker",
    description:
      "Brooklyn producer-DJ fusing hip-hop roots with restless cross-genre experimentation.",
    portraitSrc: imgDjMarcus,
  },
  {
    id: "luna",
    name: "Luna, the late-night host",
    description:
      "Reflective Chicago DJ blending music theory, emotion, and quiet human connection.",
    portraitSrc: imgDjLuna,
  },
  {
    id: "miles",
    name: "John, the vinyl nerd",
    description:
      "Lifelong vinyl obsessive spinning foundational albums and thoughtful deep cuts.",
    portraitSrc: imgDjMiles,
  },
  {
    id: "jolene",
    name: "Jolene, the Nashville heart",
    description:
      "Warm, genre-blending songwriter with Nashville roots and honky-tonk stories to tell.",
    portraitSrc: imgDjJolene,
  },
];

function buildTrackMatchKey(track: { title: string; artistName: string }): string {
  return buildCanonicalTrackKey({
    title: track.title,
    artistName: track.artistName,
  });
}

function readLocalStorageWithLegacyFallback(primaryKey: string, legacyKey?: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const primaryValue = window.localStorage.getItem(primaryKey);
  if (primaryValue !== null) {
    return primaryValue;
  }

  if (!legacyKey) {
    return null;
  }

  const legacyValue = window.localStorage.getItem(legacyKey);
  if (legacyValue !== null) {
    window.localStorage.setItem(primaryKey, legacyValue);
    return legacyValue;
  }

  return null;
}

function writeLocalStorageAndClearLegacy(primaryKey: string, value: string, legacyKey?: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(primaryKey, value);
  if (legacyKey) {
    window.localStorage.removeItem(legacyKey);
  }
}

function trackClientAnalyticsEvent(eventName: string, payload: Record<string, unknown>): void {
  if (typeof window === "undefined") {
    return;
  }

  const analyticsPayload = {
    event: eventName,
    ...payload,
  };

  const maybeDataLayer = (
    window as unknown as { dataLayer?: { push?: (event: Record<string, unknown>) => void } }
  ).dataLayer;
  if (maybeDataLayer && typeof maybeDataLayer.push === "function") {
    maybeDataLayer.push(analyticsPayload);
  }

  console.info("[W.A.I.V.][Analytics]", analyticsPayload);
}

function RewindIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path d="M11.2 6.1a1 1 0 0 1 1.6.8v10.2a1 1 0 0 1-1.6.8L4 12.8a1 1 0 0 1 0-1.6Z" fill="currentColor" />
      <path d="M20 6.1a1 1 0 0 1 1.6.8v10.2a1 1 0 0 1-1.6.8l-7.2-5.1a1 1 0 0 1 0-1.6Z" fill="currentColor" />
    </svg>
  );
}

function MainPlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-10 w-10">
      <path d="M7 4.8a1 1 0 0 1 1.5-.9l10.5 6.6a1 1 0 0 1 0 1.7L8.5 18.8A1 1 0 0 1 7 18Z" fill="currentColor" />
    </svg>
  );
}

function MainPauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-10 w-10">
      <rect x="7" y="5" width="4.5" height="14" rx="1.1" fill="currentColor" />
      <rect x="13" y="5" width="4.5" height="14" rx="1.1" fill="currentColor" />
    </svg>
  );
}

function CTAPlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 shrink-0 overflow-hidden rounded-[4px]">
      <path d="M7 4.8a1 1 0 0 1 1.5-.9l10.5 6.6a1 1 0 0 1 0 1.7L8.5 18.8A1 1 0 0 1 7 18Z" fill="currentColor" />
    </svg>
  );
}

function CTAPauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 shrink-0 overflow-hidden rounded-[4px]">
      <rect x="7" y="5" width="4.5" height="14" rx="1.1" fill="currentColor" />
      <rect x="13" y="5" width="4.5" height="14" rx="1.1" fill="currentColor" />
    </svg>
  );
}

function CTAConnectingIcon() {
  return (
    <span
      aria-hidden="true"
      className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#F0E1FF]/35 border-t-[#F0E1FF]"
    />
  );
}

function FastForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <g transform="translate(24 0) scale(-1 1)">
        <path d="M11.2 6.1a1 1 0 0 1 1.6.8v10.2a1 1 0 0 1-1.6.8L4 12.8a1 1 0 0 1 0-1.6Z" fill="currentColor" />
        <path d="M20 6.1a1 1 0 0 1 1.6.8v10.2a1 1 0 0 1-1.6.8l-7.2-5.1a1 1 0 0 1 0-1.6Z" fill="currentColor" />
      </g>
    </svg>
  );
}

function RestartMixIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M19.4 6.2A8.6 8.6 0 1 0 21 11.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.6 2.8v5.2h-5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BetaPill() {
  return (
    <span
      className="inline-flex items-center rounded-full border border-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white"
      style={{ fontFamily: "var(--font-inter), Inter, sans-serif", lineHeight: 1 }}
    >
      BETA
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const isAppleMusicConnected = useSyncExternalStore(
    subscribeAppleMusicSession,
    hasAppleMusicSession,
    () => false
  );

  const djTextFadeTimeoutRef = useRef<number | null>(null);
  const playbackBusyTimeoutRef = useRef<number | null>(null);
  const playbackBusyRef = useRef(false);
  const avatarRailRef = useRef<HTMLDivElement | null>(null);
  const avatarSwipeStartXRef = useRef<number | null>(null);
  const avatarSwipeStartYRef = useRef<number | null>(null);
  const tuneInTrackSourceByIdRef = useRef<Map<string, TuneInTrackSource>>(new Map());
  const tuneInTrackSourceByMatchKeyRef = useRef<Map<string, TuneInTrackSource>>(new Map());
  const toastIdRef = useRef(0);
  const playbackControllerRef = useRef<WaivPlaybackController | null>(null);
  const activeDjNameRef = useRef(DJS[0]?.name ?? "DJ");
  const homeOnboardingCheckedRef = useRef(false);
  const isSessionConnectingRef = useRef(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredSideDjId, setHoveredSideDjId] = useState<string | null>(null);
  const [isDjTextDimmed, setIsDjTextDimmed] = useState(false);
  const [nowPlayingTrack, setNowPlayingTrack] = useState<AppleMusicNowPlaying | null>(null);
  const [trackArtSrc, setTrackArtSrc] = useState(TRACK_ART_FALLBACK_SRC);
  const [trackProgress, setTrackProgress] = useState(0);
  const [isPlaybackBusy, setIsPlaybackBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerBarPrimed, setIsPlayerBarPrimed] = useState(false);
  const [isSessionConnecting, setIsSessionConnecting] = useState(false);
  const [toast, setToast] = useState<AppToastState | null>(null);
  const [isHomeOnboardingOpen, setIsHomeOnboardingOpen] = useState(false);
  const [sideX, setSideX] = useState(260);

  const shouldShowPlayerBar = isPlaying || isPlayerBarPrimed;
  const active = DJS[activeIndex];

  useEffect(() => {
    activeDjNameRef.current = active.name;
  }, [active.name]);

  const showToast = useCallback((message: string, durationMs = 3600) => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    toastIdRef.current += 1;
    setToast({
      id: toastIdRef.current,
      message: trimmed,
      durationMs,
    });
  }, []);

  const updateSessionConnectingState = useCallback((value: boolean) => {
    isSessionConnectingRef.current = value;
    setIsSessionConnecting(value);
  }, []);

  useEffect(() => {
    const controller = new WaivPlaybackController({
      onToast: showToast,
      onTelemetry: trackClientAnalyticsEvent,
      onStateChange: (snapshot) => {
        if (
          isSessionConnectingRef.current &&
          (snapshot.state === "playing" ||
            snapshot.state === "failed" ||
            snapshot.state === "idle")
        ) {
          updateSessionConnectingState(false);
        }
      },
      onNowPlaying: (nowPlaying: ControllerNowPlaying | null) => {
        if (!nowPlaying) {
          setNowPlayingTrack(null);
          setIsPlaying(false);
          setTrackProgress(0);
          return;
        }

        setNowPlayingTrack(nowPlaying);
        setIsPlaying(nowPlaying.isPlaying);
        setTrackProgress(nowPlaying.progress);
        setTrackArtSrc(nowPlaying.artworkUrl ?? TRACK_ART_FALLBACK_SRC);
      },
      onTrackStarted: ({ track, sessionId, firstTrackSource, firstTrackId }) => {
        tuneInTrackSourceByIdRef.current.set(track.id, track.source);

        const matchKey = buildTrackMatchKey({
          title: track.title,
          artistName: track.artistName,
        });
        tuneInTrackSourceByMatchKeyRef.current.set(matchKey, track.source);

        const history = recordTrackPlay({
          key: matchKey,
          title: track.title,
          artistName: track.artistName,
          trackId: track.id,
          genreTag: track.genreTag ?? null,
          source: track.source,
          mode: "tune-in",
          sessionId,
        });

        trackClientAnalyticsEvent("track_hosted_started", {
          reason: "new_engine",
          djName: activeDjNameRef.current,
          trackId: track.id,
          trackTitle: track.title,
          trackArtist: track.artistName,
          first_track_source: firstTrackSource ?? null,
          first_track_selected_id: firstTrackId ?? null,
          historyPlayCountAfter: history.playCount,
          track_is_suggestion: track.source === "suggestion",
        });

        setIsPlayerBarPrimed(true);
      },
    });

    playbackControllerRef.current = controller;

    return () => {
      controller.dispose();
      if (playbackControllerRef.current === controller) {
        playbackControllerRef.current = null;
      }
    };
  }, [showToast, updateSessionConnectingState]);

  const beginPlaybackBusy = useCallback(
    (options?: { timeoutMs?: number; timeoutMessage?: string }): boolean => {
      if (playbackBusyRef.current) {
        return false;
      }

      playbackBusyRef.current = true;
      setIsPlaybackBusy(true);

      if (playbackBusyTimeoutRef.current) {
        window.clearTimeout(playbackBusyTimeoutRef.current);
      }

      const timeoutMs = Math.max(2000, options?.timeoutMs ?? 12000);
      const timeoutMessage =
        options?.timeoutMessage ?? "Playback is taking longer than expected. Try again.";

      playbackBusyTimeoutRef.current = window.setTimeout(() => {
        playbackBusyRef.current = false;
        setIsPlaybackBusy(false);
        playbackBusyTimeoutRef.current = null;
        showToast(timeoutMessage);
      }, timeoutMs);

      return true;
    },
    [showToast]
  );

  const endPlaybackBusy = useCallback(() => {
    playbackBusyRef.current = false;
    if (playbackBusyTimeoutRef.current) {
      window.clearTimeout(playbackBusyTimeoutRef.current);
      playbackBusyTimeoutRef.current = null;
    }
    setIsPlaybackBusy(false);
  }, []);

  useEffect(() => {
    if (!isAppleMusicConnected) {
      router.replace("/login");
    }
  }, [isAppleMusicConnected, router]);

  useEffect(() => {
    let isMounted = true;

    if (!isAppleMusicConnected) {
      return () => {
        isMounted = false;
      };
    }

    void (async () => {
      const state = await getAppleMusicAuthorizationState();
      if (!isMounted) {
        return;
      }

      if (!state.isAuthorized) {
        clearAppleMusicSession();
        router.replace("/login");
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isAppleMusicConnected, router]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined" || !isAppleMusicConnected) {
      return;
    }
    if (homeOnboardingCheckedRef.current) {
      return;
    }

    homeOnboardingCheckedRef.current = true;

    const hasSeen =
      readLocalStorageWithLegacyFallback(
        HOME_ONBOARDING_SEEN_KEY,
        LEGACY_HOME_ONBOARDING_SEEN_KEY
      ) === "true";

    if (!hasSeen) {
      setIsHomeOnboardingOpen(true);
    }
  }, [isAppleMusicConnected, isHydrated]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsDjTextDimmed(true);
      djTextFadeTimeoutRef.current = null;
    }, DJ_TEXT_IDLE_FADE_MS);

    djTextFadeTimeoutRef.current = timeout;

    return () => {
      if (djTextFadeTimeoutRef.current) {
        window.clearTimeout(djTextFadeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToast((currentToast) => {
        if (!currentToast || currentToast.id !== toast.id) {
          return currentToast;
        }
        return null;
      });
    }, toast.durationMs);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (playbackBusyTimeoutRef.current) {
        window.clearTimeout(playbackBusyTimeoutRef.current);
        playbackBusyTimeoutRef.current = null;
      }
      playbackBusyRef.current = false;
    };
  }, []);

  useEffect(() => {
    const compute = () => {
      const railWidth =
        avatarRailRef.current?.clientWidth ??
        (typeof window === "undefined" ? 900 : window.innerWidth);

      const visible = railWidth < 420 ? 58 : railWidth < 640 ? 70 : railWidth < 1024 ? 90 : 112;
      const activeRadius = 304 / 2;
      const sideRadius = (304 * SIDE_DJ_SCALE) / 2;
      const peekingDistance = Math.round(railWidth / 2 + sideRadius - visible);
      const edgeGap = railWidth < 420 ? 4 : SIDE_DJ_CLEAR_GAP_PX;
      const minimumDistance = Math.ceil(activeRadius + sideRadius + edgeGap);
      const x = Math.max(peekingDistance, minimumDistance);
      setSideX(Math.min(980, Math.max(200, x)));
    };

    compute();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => compute())
        : null;

    if (observer && avatarRailRef.current) {
      observer.observe(avatarRailRef.current);
    }

    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("resize", compute);
      observer?.disconnect();
    };
  }, []);

  const items = useMemo(() => {
    return DJS.map((dj, i) => ({ dj, pos: i - activeIndex }));
  }, [activeIndex]);

  const maxIndex = DJS.length - 1;
  const activeDjFirstName = active.name.split(",")[0] ?? "Your DJ";
  const tuneInCTA = isSessionConnecting
    ? { label: "Connecting...", icon: <CTAConnectingIcon /> }
    : !isPlaying
      ? { label: `Tune in with ${activeDjFirstName} now`, icon: <CTAPlayIcon /> }
      : { label: `Pause ${activeDjFirstName}`, icon: <CTAPauseIcon /> };

  const nowPlayingTrackMatchKey = nowPlayingTrack
    ? buildTrackMatchKey({
        title: nowPlayingTrack.title,
        artistName: nowPlayingTrack.artistName,
      })
    : "";

  const nowPlayingTrackSource: TuneInTrackSource | "unknown" = nowPlayingTrack
    ? tuneInTrackSourceByIdRef.current.get(nowPlayingTrack.id) ??
      tuneInTrackSourceByMatchKeyRef.current.get(nowPlayingTrackMatchKey) ??
      "unknown"
    : "unknown";

  const isNowPlayingSuggestion = nowPlayingTrackSource === "suggestion";

  const clearDjTextFadeTimer = () => {
    if (djTextFadeTimeoutRef.current) {
      window.clearTimeout(djTextFadeTimeoutRef.current);
      djTextFadeTimeoutRef.current = null;
    }
  };

  const scheduleDjTextFade = () => {
    clearDjTextFadeTimer();
    djTextFadeTimeoutRef.current = window.setTimeout(() => {
      setIsDjTextDimmed(true);
      djTextFadeTimeoutRef.current = null;
    }, DJ_TEXT_IDLE_FADE_MS);
  };

  const revealDjTextAndRestartTimer = () => {
    setIsDjTextDimmed(false);
    scheduleDjTextFade();
  };

  const goLeft = () => {
    revealDjTextAndRestartTimer();
    setActiveIndex((index) => Math.max(0, index - 1));
  };

  const goRight = () => {
    revealDjTextAndRestartTimer();
    setActiveIndex((index) => Math.min(maxIndex, index + 1));
  };

  const onAvatarRailPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    avatarSwipeStartXRef.current = event.clientX;
    avatarSwipeStartYRef.current = event.clientY;
    revealDjTextAndRestartTimer();
  };

  const onAvatarRailPointerCancel = () => {
    avatarSwipeStartXRef.current = null;
    avatarSwipeStartYRef.current = null;
  };

  const onAvatarRailPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const startX = avatarSwipeStartXRef.current;
    const startY = avatarSwipeStartYRef.current;
    avatarSwipeStartXRef.current = null;
    avatarSwipeStartYRef.current = null;

    if (startX === null || startY === null) {
      return;
    }

    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;

    if (Math.abs(deltaY) > DJ_RAIL_VERTICAL_GUARD_PX && Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    if (deltaX > DJ_RAIL_SWIPE_THRESHOLD_PX && activeIndex > 0) {
      goLeft();
      return;
    }

    if (deltaX < -DJ_RAIL_SWIPE_THRESHOLD_PX && activeIndex < maxIndex) {
      goRight();
    }
  };

  const dismissHomeOnboarding = useCallback(() => {
    setIsHomeOnboardingOpen(false);
    if (typeof window !== "undefined") {
      writeLocalStorageAndClearLegacy(
        HOME_ONBOARDING_SEEN_KEY,
        "true",
        LEGACY_HOME_ONBOARDING_SEEN_KEY
      );
    }
  }, []);

  const onPlayTuneIn = useCallback(async () => {
    if (playbackBusyRef.current || isPlaybackBusy) {
      return;
    }

    updateSessionConnectingState(true);
    setIsPlayerBarPrimed(true);

    if (
      !beginPlaybackBusy({
        timeoutMs: 30000,
        timeoutMessage: "Starting Tune-In is taking longer than expected. Try again.",
      })
    ) {
      updateSessionConnectingState(false);
      return;
    }

    try {
      const controller = playbackControllerRef.current;
      if (!controller) {
        showToast("Playback engine is not ready.");
        updateSessionConnectingState(false);
        return;
      }

      const result = await controller.startNewSession({
        dj: {
          id: active.id,
          name: active.name,
        },
      });

      if (!result.ok || !result.sessionId || !result.firstTrack) {
        setIsPlaying(false);
        setIsPlayerBarPrimed(false);
        updateSessionConnectingState(false);
        if (result.error === "busy") {
          showToast("Playback is already starting.");
        } else {
          // The controller emits precise toasts for session start failures.
          // Avoid replacing them with a generic duplicate.
          console.warn("[W.A.I.V.][Session Start Failed]", result.error ?? "unknown");
        }
        return;
      }

      registerListeningSession({
        sessionId: result.sessionId,
        mode: "tune-in",
      });

      trackClientAnalyticsEvent("tune_in_session_started", {
        sessionId: result.sessionId,
        djName: active.name,
        first_track_source: result.firstTrackSource,
        first_track_selected_id: result.firstTrack.id,
      });

      setIsPlayerBarPrimed(true);
      updateSessionConnectingState(false);
    } catch (error) {
      console.warn("[W.A.I.V.][New Playback Engine Start Error]", error);
      setIsPlaying(false);
      setIsPlayerBarPrimed(false);
      updateSessionConnectingState(false);
      showToast("Could not start playback right now.");
    } finally {
      endPlaybackBusy();
    }
  }, [
    active.id,
    active.name,
    beginPlaybackBusy,
    endPlaybackBusy,
    isPlaybackBusy,
    showToast,
    updateSessionConnectingState,
  ]);

  const onToggleMainPlayback = useCallback(() => {
    if (playbackBusyRef.current || isPlaybackBusy) {
      return;
    }

    if (!beginPlaybackBusy()) {
      return;
    }

    void (async () => {
      try {
        const controller = playbackControllerRef.current;
        if (!controller) {
          showToast("Playback engine is not ready.");
          return;
        }

        const playing = await controller.togglePlayPause();
        setIsPlaying(playing);
      } catch {
        showToast("Playback control is unavailable.");
      } finally {
        endPlaybackBusy();
      }
    })();
  }, [beginPlaybackBusy, endPlaybackBusy, isPlaybackBusy, showToast]);

  const onNextTrack = useCallback(() => {
    if (playbackBusyRef.current || isPlaybackBusy) {
      return;
    }

    if (!beginPlaybackBusy()) {
      return;
    }

    void (async () => {
      try {
        const controller = playbackControllerRef.current;
        if (!controller) {
          showToast("Playback engine is not ready.");
          return;
        }

        const started = await controller.skipNext();
        if (!started) {
          showToast("Next track is unavailable.");
        }
      } catch {
        showToast("Next track is unavailable.");
      } finally {
        endPlaybackBusy();
      }
    })();
  }, [beginPlaybackBusy, endPlaybackBusy, isPlaybackBusy, showToast]);

  const onPreviousTrack = useCallback(() => {
    if (playbackBusyRef.current || isPlaybackBusy) {
      return;
    }
    showToast("Previous track is unavailable in Tune-In right now.");
  }, [isPlaybackBusy, showToast]);

  const onRestartTuneIn = useCallback(() => {
    if (playbackBusyRef.current || isPlaybackBusy) {
      return;
    }
    void onPlayTuneIn();
  }, [isPlaybackBusy, onPlayTuneIn]);

  const onActiveAvatarControl = useCallback(() => {
    if (playbackBusyRef.current || isPlaybackBusy) {
      return;
    }

    if (!shouldShowPlayerBar) {
      void onPlayTuneIn();
      return;
    }

    onToggleMainPlayback();
  }, [isPlaybackBusy, onPlayTuneIn, onToggleMainPlayback, shouldShowPlayerBar]);

  if (!isHydrated) {
    return (
      <div
        className="relative min-h-screen overflow-hidden text-[#f0e1ff]"
        style={{
          background:
            "linear-gradient(135deg, #0A0006 0%, #140014 45%, #010102 100%)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-0 noise-layer" />
        <div className="vignette-layer absolute inset-0 z-0" />
        <div className="relative z-10 grid min-h-screen place-items-center px-6">
          <div
            className="inline-flex items-center rounded-[100px] border border-[#BA7EF4] bg-[rgba(186,126,244,0.12)] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-[#F0E1FF]"
            style={{ fontFamily: "var(--font-instrument-sans)" }}
          >
            Loading W.A.I.V...
          </div>
        </div>
      </div>
    );
  }

  if (!isAppleMusicConnected) {
    return null;
  }

  const shouldHideTuneInCTA = shouldShowPlayerBar && !isSessionConnecting;

  return (
    <div
      className="relative h-screen overflow-hidden text-[#f0e1ff]"
      style={{
        background:
          "linear-gradient(135deg, #0A0006 0%, #140014 45%, #010102 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 z-0 noise-layer" />

      <header className="relative z-10 h-[72px] px-6 pt-6">
        <div className="absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-2">
          <Image
            src="/images/logo_waiv.svg"
            alt="W.A.I.V."
            width={120}
            height={16}
            priority
            className="h-[28px] w-auto object-contain"
          />
          <BetaPill />
        </div>
      </header>

      <div className="relative z-10 h-[calc(100vh-72px)]">
        <main className="relative h-full min-w-0 flex-1 px-6">
          <div className="flex h-full min-h-0 items-center justify-center">
            <div className="flex w-full flex-col items-center">
              <motion.div
                ref={avatarRailRef}
                className="relative h-[304px] w-full max-w-none"
                aria-label="DJ selector"
                style={{ touchAction: "pan-x" }}
                onMouseEnter={() => {
                  setIsDjTextDimmed(false);
                  clearDjTextFadeTimer();
                }}
                onMouseLeave={scheduleDjTextFade}
                onPointerDown={onAvatarRailPointerDown}
                onPointerUp={onAvatarRailPointerUp}
                onPointerCancel={onAvatarRailPointerCancel}
                onPointerLeave={onAvatarRailPointerCancel}
              >
                {items
                  .filter(({ pos }) => Math.abs(pos) <= 2)
                  .map(({ dj, pos }) => {
                    const isActive = pos === 0;
                    const isSide = Math.abs(pos) === 1;

                    const x =
                      pos === 0
                        ? 0
                        : pos === -1
                          ? -sideX
                          : pos === 1
                            ? sideX
                            : pos === -2
                              ? -sideX * 1.85
                              : sideX * 1.85;

                    const scale = isActive ? 1 : isSide ? SIDE_DJ_SCALE : 0.62;
                    const isHoveredSide = isSide && hoveredSideDjId === dj.id;
                    const opacity = isActive ? 1 : isSide ? (isHoveredSide ? 1 : 0.72) : 0;

                    const clickHandler =
                      isActive ? onActiveAvatarControl : pos === -1 ? goLeft : pos === 1 ? goRight : undefined;
                    const isAvatarInteractive = isActive || isSide;

                    return (
                      <button
                        key={dj.id}
                        type="button"
                        onClick={clickHandler}
                        disabled={isActive ? isPlaybackBusy : false}
                        aria-label={
                          isActive
                            ? shouldShowPlayerBar
                              ? `Pause or resume playback with ${dj.name}`
                              : `Start playback with ${dj.name}`
                            : isSide
                              ? `Switch to ${dj.name}`
                              : `${dj.name}`
                        }
                        className={`absolute left-1/2 top-1/2 ${
                          isAvatarInteractive ? "group cursor-pointer" : "cursor-default"
                        }`}
                        style={{
                          width: 304,
                          height: 304,
                          zIndex: isActive ? 3 : 2,
                          transform: `translate(-50%, -50%) translateX(${x}px) scale(${scale})`,
                          opacity,
                          transition: `transform ${TRANSFORM_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${OPACITY_MS}ms ease`,
                          willChange: "transform, opacity",
                          pointerEvents: isAvatarInteractive ? "auto" : "none",
                        }}
                        onMouseEnter={() => {
                          if (isSide) {
                            setHoveredSideDjId(dj.id);
                          }
                        }}
                        onMouseLeave={() => {
                          if (isSide) {
                            setHoveredSideDjId((current) => (current === dj.id ? null : current));
                          }
                        }}
                      >
                        <div
                          className={`relative h-full w-full rounded-full ${
                            isActive
                              ? "airwaves-border-pulse bg-gradient-to-b from-[#BA7EF4] to-[#EC4899] p-[4px]"
                              : "p-[0px]"
                          }`}
                        >
                          <div
                            className={`relative h-full w-full overflow-hidden rounded-full bg-black ${
                              isActive
                                ? "shadow-[inset_0_0_60px_0_#000000,inset_0_0_28px_0_rgba(216,84,242,0.18)]"
                                : "shadow-[0_0_22px_rgba(216,84,242,0.10),inset_0_0_42px_0_#000000]"
                            }`}
                          >
                            <Image
                              src={dj.portraitSrc}
                              alt=""
                              fill
                              sizes="304px"
                              unoptimized
                              className="absolute inset-0 h-full w-full object-cover"
                              draggable={false}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </motion.div>

              <div
                className="relative mt-[28px] min-h-[190px] w-[310px] max-w-[86vw] text-center sm:min-h-[170px] md:min-h-[150px]"
                style={{ fontFamily: "var(--font-instrument-sans)" }}
                onMouseEnter={() => {
                  setIsDjTextDimmed(false);
                  clearDjTextFadeTimer();
                }}
                onMouseLeave={scheduleDjTextFade}
                onFocusCapture={revealDjTextAndRestartTimer}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div
                      className={`whitespace-nowrap text-[26px] leading-none transition-opacity ${
                        isDjTextDimmed ? "opacity-25" : "opacity-100"
                      }`}
                      style={{
                        fontFamily: "var(--font-instrument-serif)",
                        letterSpacing: "-0.01em",
                        transitionDuration: `${DJ_TEXT_FADE_DURATION_MS}ms`,
                      }}
                    >
                      {active.name}
                    </div>
                    <div
                      className={`mt-[8px] text-[14px] leading-normal text-[#be7bff] transition-opacity ${
                        isDjTextDimmed ? "opacity-25" : "opacity-100"
                      }`}
                      style={{
                        fontFamily: "var(--font-instrument-sans)",
                        transitionDuration: `${DJ_TEXT_FADE_DURATION_MS}ms`,
                      }}
                    >
                      {active.description}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-5 h-[64px]">
                <motion.button
                  type="button"
                  onClick={onActiveAvatarControl}
                  disabled={isPlaybackBusy || shouldShowPlayerBar || isSessionConnecting}
                  aria-hidden={shouldHideTuneInCTA}
                  tabIndex={shouldHideTuneInCTA ? -1 : 0}
                  initial={false}
                  animate={{
                    opacity: shouldHideTuneInCTA ? 0 : 1,
                    y: shouldHideTuneInCTA ? 10 : 0,
                    scale: shouldHideTuneInCTA ? 0.992 : 1,
                  }}
                  transition={{ duration: 0.46, ease: [0.19, 1, 0.22, 1] }}
                  className={`inline-flex h-[64px] items-center justify-center gap-[12px] rounded-full border-2 border-[#F444AC] px-[24px] text-[#F0E1FF] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[#ff63bb] hover:shadow-[0_0_22px_rgba(244,68,172,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f444ac]/40 focus-visible:ring-offset-0 active:translate-y-0 ${
                    shouldHideTuneInCTA ? "pointer-events-none" : ""
                  } ${isPlaybackBusy ? "cursor-wait opacity-75" : ""}`}
                  style={{
                    background: "linear-gradient(180deg, rgba(186,126,244,0.32) 0%, rgba(244,68,172,0.32) 100%)",
                    borderRadius: "1000px",
                    fontFamily: "var(--font-instrument-sans)",
                  }}
                  aria-label={tuneInCTA.label}
                >
                  <span className="shrink-0 text-[#F0E1FF]">{tuneInCTA.icon}</span>
                  <span className="text-[16px] font-medium">{tuneInCTA.label}</span>
                </motion.button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {shouldShowPlayerBar ? (
          <motion.footer
            className="fixed bottom-0 left-0 right-0 z-20"
            initial={{ y: 220 }}
            animate={{ y: 0 }}
            exit={{ y: 220 }}
            transition={{ type: "spring", stiffness: 62, damping: 24, mass: 1.2 }}
          >
            <div className="h-[4px] w-full bg-black/90">
              <div
                className="h-full shadow-[0_0_10px_rgba(212,84,242,0.45)] transition-[width] duration-500 ease-linear"
                style={{
                  width: `${Math.max(0, Math.min(100, trackProgress * 100))}%`,
                  background: "linear-gradient(90deg, #F444AC 0%, #D854F2 45%, #BA7EF4 100%)",
                }}
              />
            </div>

            <div className="bg-[#0d060d] px-[24px] py-[24px]">
              <div className="w-full">
                <div className="grid grid-cols-[1fr_auto] items-center gap-4 sm:grid-cols-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-[48px] w-[48px] shrink-0 overflow-hidden rounded-[2px]">
                      <Image
                        src={trackArtSrc || TRACK_ART_FALLBACK_SRC}
                        alt={nowPlayingTrack ? `${nowPlayingTrack.title} cover art` : "Album cover art"}
                        width={48}
                        height={48}
                        unoptimized
                        className="h-full w-full object-cover"
                        draggable={false}
                        onError={() => {
                          if (trackArtSrc !== TRACK_ART_FALLBACK_SRC) {
                            setTrackArtSrc(TRACK_ART_FALLBACK_SRC);
                          }
                        }}
                      />
                    </div>

                    <div className="min-w-0" style={{ fontFamily: "var(--font-instrument-sans)" }}>
                      {nowPlayingTrack ? (
                        <>
                          <div className="truncate text-[18px] font-semibold leading-tight text-[#f444ac]">
                            {nowPlayingTrack.title}
                          </div>
                          <div className="mt-[2px] flex min-w-0 items-center gap-2 text-[14px] font-medium leading-tight text-[#f0e1ff]">
                            <span className="truncate">{nowPlayingTrack.artistName}</span>
                            {isNowPlayingSuggestion ? (
                              <span className="shrink-0 rounded-[999px] border border-[#F444AC] bg-[rgba(244,68,172,0.16)] px-2 py-[2px] text-[11px] font-medium text-[#F0E1FF]">
                                Suggested
                              </span>
                            ) : null}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-8 sm:justify-center sm:gap-10">
                    <button
                      className="grid h-10 w-10 place-items-center rounded-[8px] border border-transparent text-[#E8D9FF] transition-all duration-150 hover:bg-[rgba(186,126,244,0.18)] active:bg-[rgba(186,126,244,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BA7EF4]/35 disabled:cursor-wait disabled:opacity-70"
                      aria-label="Previous"
                      type="button"
                      onClick={onPreviousTrack}
                      disabled={isPlaybackBusy}
                    >
                      <span className="-translate-x-[1px]">
                        <RewindIcon />
                      </span>
                    </button>

                    <button
                      className="group grid h-14 w-14 place-items-center rounded-[10px] border border-transparent p-1 text-[#E8D9FF] transition-all duration-150 hover:bg-[rgba(186,126,244,0.18)] active:bg-[rgba(186,126,244,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BA7EF4]/35 disabled:cursor-wait disabled:opacity-70"
                      aria-label="Play/Pause"
                      type="button"
                      onClick={onToggleMainPlayback}
                      disabled={isPlaybackBusy}
                    >
                      <span className="transition-transform duration-150 group-hover:-translate-x-[1px] group-active:-translate-x-[1px]">
                        {isPlaying ? <MainPauseIcon /> : <MainPlayIcon />}
                      </span>
                    </button>

                    <button
                      className="grid h-10 w-10 place-items-center rounded-[8px] border border-transparent text-[#E8D9FF] transition-all duration-150 hover:bg-[rgba(186,126,244,0.18)] active:bg-[rgba(186,126,244,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BA7EF4]/35 disabled:cursor-wait disabled:opacity-70"
                      aria-label="Next"
                      type="button"
                      onClick={onNextTrack}
                      disabled={isPlaybackBusy}
                    >
                      <FastForwardIcon />
                    </button>
                  </div>

                  <div className="hidden sm:flex items-center justify-end">
                    <button
                      type="button"
                      aria-label="Start a fresh tune-in mix"
                      title="Start a fresh tune-in mix"
                      onClick={onRestartTuneIn}
                      disabled={isPlaybackBusy}
                      className="grid h-10 w-10 place-items-center rounded-[8px] border border-transparent text-[#C8A8F7] transition-all duration-150 hover:bg-[rgba(186,126,244,0.14)] hover:text-[#E8D9FF] active:bg-[rgba(186,126,244,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BA7EF4]/35 disabled:cursor-wait disabled:opacity-70"
                    >
                      <RestartMixIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.footer>
        ) : null}
      </AnimatePresence>

      <AppToast toast={toast} shouldShowPlayerBar={shouldShowPlayerBar} rightOffsetPx={0} />

      <FirstTimeHomeOnboardingModal
        isOpen={isHomeOnboardingOpen}
        avatars={DJS}
        onPrimaryAction={dismissHomeOnboarding}
      />
    </div>
  );
}
