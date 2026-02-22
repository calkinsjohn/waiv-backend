"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";

type FirstTimeHomeOnboardingAvatar = {
  id: string;
  name: string;
  portraitSrc: string;
};

type FirstTimeHomeOnboardingModalProps = {
  isOpen: boolean;
  avatars: FirstTimeHomeOnboardingAvatar[];
  onPrimaryAction: () => void;
  title?: string;
  description?: string;
  primaryLabel?: string;
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function FirstTimeHomeOnboardingModal({
  isOpen,
  avatars,
  onPrimaryAction,
  title = "Welcome to W.A.I.V.",
  description = "Pick a DJ. They’ll spin a radio-style mix from your Apple Music favorites, plus fresh picks based on what you love.",
  primaryLabel = "Start listening",
}: FirstTimeHomeOnboardingModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  const dismiss = onPrimaryAction;
  const visibleAvatars = useMemo(() => avatars.slice(0, 4), [avatars]);
  const trimmedTitle = title.trim();
  const brandWord = "W.A.I.V.";
  const brandIndex = trimmedTitle.toLowerCase().indexOf(brandWord.toLowerCase());
  const shouldRenderBrandGradient = brandIndex >= 0;
  const beforeBrand = shouldRenderBrandGradient
    ? trimmedTitle.slice(0, brandIndex)
    : "";
  const brandSlice = shouldRenderBrandGradient
    ? trimmedTitle.slice(brandIndex, brandIndex + brandWord.length)
    : "";
  const afterBrand = shouldRenderBrandGradient
    ? trimmedTitle.slice(brandIndex + brandWord.length)
    : "";

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      return;
    }

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      primaryButtonRef.current?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const container = modalRef.current;
      if (!container) {
        return;
      }

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => !element.hasAttribute("disabled") && element.tabIndex !== -1);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [dismiss, isOpen]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(5,2,11,0.8)] px-5 py-8 backdrop-blur-[6px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="w-full max-w-[560px] rounded-[40px] border border-[#BA7EF4] bg-[#0F0A1A] p-12 shadow-[0_24px_80px_rgba(0,0,0,0.62),0_0_44px_rgba(186,126,244,0.2)]"
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="home-onboarding-title"
              aria-describedby="home-onboarding-description"
              className="flex flex-col items-center gap-6 text-[#F0E1FF]"
            >
              <div className="flex items-center justify-center">
                {visibleAvatars.map((avatar, index) => (
                  <div
                    key={avatar.id}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-[1000px] border-[4px] border-[#0F0A1A] bg-[#0F0A1A] ${
                      index > 0 ? "-ml-[12px]" : ""
                    }`}
                  >
                    <Image
                      src={avatar.portraitSrc}
                      alt={avatar.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                      draggable={false}
                    />
                  </div>
                ))}
              </div>

              <div className="flex w-full flex-col items-center gap-[12px]">
                <h2
                  id="home-onboarding-title"
                  className="w-full max-w-[496px] text-center text-[48px] font-normal leading-normal text-[#F0E1FF]"
                  style={{ fontFamily: "var(--font-instrument-serif)" }}
                >
                  {shouldRenderBrandGradient ? (
                    <>
                      <span>{beforeBrand}</span>
                      <span
                        style={{
                          background:
                            "var(--gradient-main, linear-gradient(180deg, var(--surface-purple, #BA7EF4) 0%, var(--surface-pink, #F444AC) 100%))",
                          backgroundClip: "text",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                        }}
                      >
                        {brandSlice}
                      </span>
                      <span>{afterBrand}</span>
                    </>
                  ) : (
                    trimmedTitle
                  )}
                </h2>

                <p
                  id="home-onboarding-description"
                  className="w-full max-w-[496px] text-center text-[16px] font-normal leading-normal text-[#BA7EF4]"
                  style={{ fontFamily: "var(--font-instrument-sans)" }}
                >
                  {description}
                </p>
              </div>

              <div className="mt-[12px] w-full">
                <button
                  ref={primaryButtonRef}
                  type="button"
                  onClick={onPrimaryAction}
                  className="inline-flex h-[64px] w-full items-center justify-center gap-[12px] rounded-full border-2 border-[#F444AC] px-[24px] text-[#f0e1ff] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[#ff63bb] hover:shadow-[0_0_22px_rgba(244,68,172,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f444ac]/40 focus-visible:ring-offset-0 active:translate-y-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(186,126,244,0.32) 0%, rgba(244,68,172,0.32) 100%)",
                    borderRadius: "1000px",
                    fontFamily: "var(--font-instrument-sans)",
                  }}
                >
                  <span className="text-[16px] font-medium">{primaryLabel}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
