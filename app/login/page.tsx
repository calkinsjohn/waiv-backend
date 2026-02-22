"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  hasAppleMusicSession, subscribeAppleMusicSession
} from "../appleMusicSession";
import {
  authorizeAppleMusic,
  getAppleMusicAuthorizationState,
} from "../appleMusicClient";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 shrink-0 rounded-[4px] overflow-hidden">
      <path
        d="M6 4v16l14-8z"
        fill="currentColor"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 shrink-0">
      <path
        fill="currentColor"
        d="M16.6 13.2c0-2 1.6-3 1.7-3.1-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.8-2.6-.8-1.3 0-2.6.8-3.3 1.9-1.4 2.4-.4 5.9 1 7.9.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7 1.1 0 1.9-1.1 2.6-2.1.8-1.2 1.1-2.3 1.1-2.4-.1 0-2.4-.9-2.4-3.7z"
      />
      <path
        fill="currentColor"
        d="M14.8 6.9c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.7 1.3-.6.6-1.1 1.6-1 2.6 1 .1 2-.5 2.8-1.2z"
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

/**
 * NOTE:
 * This page intentionally mirrors the Home page background:
 * - same linear gradient
 * - noise-layer overlay
 * - vignette-layer overlay
 */
export default function LoginPage() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showSetupScreen, setShowSetupScreen] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const isAppleMusicConnected = useSyncExternalStore(
    subscribeAppleMusicSession,
    hasAppleMusicSession,
    () => false
  );

  useEffect(() => {
    if (isAppleMusicConnected && !isConnecting && !showSetupScreen) {
      router.replace("/");
    }
  }, [isAppleMusicConnected, isConnecting, showSetupScreen, router]);

  useEffect(() => {
    let isMounted = true;

    if (isAppleMusicConnected || isConnecting || showSetupScreen) {
      return () => {
        isMounted = false;
      };
    }

    void (async () => {
      const state = await getAppleMusicAuthorizationState();
      if (isMounted && state.isAuthorized) {
        router.replace("/");
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isAppleMusicConnected, isConnecting, showSetupScreen, router]);

  useEffect(() => {
    if (!showSetupScreen) {
      return;
    }

    const timeouts: number[] = [];

    timeouts.push(
      window.setTimeout(() => setSetupStep(1), 1400),
      window.setTimeout(() => setSetupStep(2), 3200),
      window.setTimeout(() => router.replace("/"), 5400)
    );

    return () => {
      for (const timeout of timeouts) {
        window.clearTimeout(timeout);
      }
    };
  }, [showSetupScreen, router]);

  const onPlaySample = () => {
    // Placeholder for now. Next step can be: play an mp3 + show “Now Playing” micro UI.
    alert("DJ sample playback is coming next (we’ll wire audio after the UI is locked).");
  };

  const onConnectAppleMusic = () => {
    if (isConnecting) {
      return;
    }

    setConnectError(null);
    setIsConnecting(true);
    void (async () => {
      try {
        await authorizeAppleMusic();
        setIsConnecting(false);
        setShowSetupScreen(true);
        setSetupStep(0);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not connect Apple Music. Please try again.";
        setConnectError(message);
        setIsConnecting(false);
      }
    })();
  };

  if (isAppleMusicConnected && !showSetupScreen) {
    return null;
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden text-[#f0e1ff]"
      style={{
        background:
          "linear-gradient(135deg, #0A0006 0%, #140014 45%, #010102 100%)",
      }}
    >
      {/* Same overlays as Home */}
      <div className="pointer-events-none absolute inset-0 z-0 noise-layer" />
      <div className="vignette-layer absolute inset-0 z-0" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1100px] items-center justify-center px-6">
        <div className="w-full max-w-[860px] text-center">
          {showSetupScreen ? (
            <div className="mx-auto max-w-[560px] text-center">
              <div className="mx-auto mb-10 flex flex-col items-center gap-2">
                <BetaPill />
                <Image
                  src="/images/logo_waiv.svg"
                  alt="W.A.I.V."
                  width={120}
                  height={16}
                  priority
                  className="h-[28px] w-auto object-contain"
                />
              </div>

              <h1
                className="mx-auto text-[40px] leading-[1.08] sm:text-[54px]"
                style={{
                  fontFamily: "var(--font-instrument-serif)",
                  letterSpacing: "-0.02em",
                }}
              >
                Getting your session ready
              </h1>

              <div
                className="mx-auto mt-8 space-y-3 text-[16px] leading-[1.4] sm:text-[18px]"
                style={{ fontFamily: "var(--font-instrument-sans)" }}
              >
                <p className="text-[#f0e1ff]">Connected to Apple Music</p>
                <p className={setupStep >= 1 ? "text-[#d7a2ff]" : "text-[#d7a2ff]/45"}>
                  Loading your library
                </p>
                <p className={setupStep >= 2 ? "text-[#be7bff]" : "text-[#be7bff]/45"}>
                  Starting your DJ session
                </p>
              </div>

              <div className="mt-8 flex justify-center">
                <div className="h-[3px] w-[180px] overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full bg-[linear-gradient(90deg,#F444AC_0%,#D854F2_45%,#BA7EF4_100%)] transition-all duration-700 ${
                      setupStep === 0 ? "w-[34%]" : setupStep === 1 ? "w-[68%]" : "w-full"
                    }`}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {!showSetupScreen ? (
          <>
          {/* Brand */}
          <div className="mx-auto mb-10 flex flex-col items-center gap-2">
            <BetaPill />
            <Image
              src="/images/logo_waiv.svg"
              alt="W.A.I.V."
              width={120}
              height={16}
              priority
              className="h-[28px] w-auto object-contain"
            />
          </div>

          {/* Headline */}
          <h1
            className="mx-auto text-[52px] leading-[1.05] sm:text-[72px]"
            style={{
              fontFamily: "var(--font-instrument-serif)",
              letterSpacing: "-0.02em",
            }}
          >
            Radio. Reinvented.
          </h1>

          {/* Subhead */}
          <p
            className="mx-auto mt-6 max-w-[620px] text-[16px] leading-[1.6] text-[#be7bff] sm:text-[18px]"
            style={{ fontFamily: "var(--font-instrument-sans)" }}
          >
            The warmth of radio DJs. The intelligence of AI.
            <br />
            A new listening experience that’s uniquely yours.
          </p>

          {/* CTAs */}
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <button
              type="button"
              onClick={onPlaySample}
              className="inline-flex h-[64px] items-center justify-center gap-[12px] rounded-[1000px] border-2 border-[#BA7EF4] px-[24px] text-[#f0e1ff] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[#d494ff] hover:bg-white/[0.03] hover:shadow-[0_0_22px_rgba(186,126,244,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BA7EF4]/40 focus-visible:ring-offset-0 active:translate-y-0"
              style={{ fontFamily: "var(--font-instrument-sans)" }}
            >
              <PlayIcon />
              <span className="text-[16px] font-medium">
                Play DJ sample
              </span>
            </button>

            <button
              type="button"
              onClick={onConnectAppleMusic}
              disabled={isConnecting}
              className="inline-flex h-[64px] w-full items-center justify-center gap-[12px] rounded-full border-2 border-[#F444AC] px-[24px] text-[#f0e1ff] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[#ff63bb] hover:shadow-[0_0_22px_rgba(244,68,172,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f444ac]/40 focus-visible:ring-offset-0 active:translate-y-0 disabled:cursor-wait disabled:opacity-80 sm:w-auto"
              style={{
                background: "linear-gradient(180deg, rgba(186,126,244,0.32) 0%, rgba(244,68,172,0.32) 100%)",
                borderRadius: "1000px",
                fontFamily: "var(--font-instrument-sans)"
              }}
            >
              <AppleIcon />
              <span className="text-[16px] font-medium">
                {isConnecting ? "Connecting to Apple Music..." : "Connect Apple Music to get started"}
              </span>
            </button>
          </div>

          {/* Tiny helper line (optional, feels premium) */}
          <div
            className="mt-10 text-[12px] text-white/40"
            style={{ fontFamily: "var(--font-instrument-sans)" }}
          >
            {connectError ? (
              <div className="mb-4 text-[12px] text-[#ff8ccf]">{connectError}</div>
            ) : null}
            Designed by a human. Coded with AI.
            <br />
            Built for people who miss real radio.
          </div>
          </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
