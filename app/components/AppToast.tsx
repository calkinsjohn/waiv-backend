"use client";

import { AnimatePresence, motion } from "framer-motion";

export type AppToastState = {
  id: number;
  message: string;
  durationMs: number;
};

type AppToastProps = {
  toast: AppToastState | null;
  shouldShowPlayerBar: boolean;
  rightOffsetPx: number;
};

export function AppToast({ toast, shouldShowPlayerBar, rightOffsetPx }: AppToastProps) {
  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          className={`pointer-events-none fixed left-0 z-40 flex justify-center transition-[right] duration-300 ${
            shouldShowPlayerBar ? "bottom-[178px]" : "bottom-6"
          }`}
          style={{ right: `${rightOffsetPx}px` }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          role="status"
          aria-live="polite"
          transition={{ duration: 0.2 }}
        >
          <span
            className="rounded-[100px] border border-[#BA7EF4] bg-[#0D0C14]/90 px-4 py-2 text-[12px] font-semibold text-[#F0E1FF] backdrop-blur-sm"
            style={{ fontFamily: "var(--font-instrument-sans)" }}
          >
            {toast.message}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
