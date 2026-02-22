import { getAppleMusicVolume, setAppleMusicVolume } from "../appleMusicClient";

type VoiceResult = {
  started: boolean;
  completed: boolean;
  durationMs: number;
};

type VoicePlayInput = {
  djId: string;
  text: string;
  overlapStartMsBeforeEnd?: number;
  onOverlapStart?: () => Promise<void> | void;
};

function estimateSpeechDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3500, words * 430);
}

export class AudioOrchestrator {
  private djAudio: HTMLAudioElement | null = null;
  private djAudioUrl: string | null = null;
  private musicBaseVolume = 1;
  private activeFadeRaf: number | null = null;

  dispose(): void {
    this.stopDjAudio();
  }

  async playVoiceLine(input: VoicePlayInput): Promise<VoiceResult> {
    this.stopDjAudio();
    const remote = await this.playRemote(input);
    if (remote.started) {
      return remote;
    }
    return await this.playLocal(input.text, input.overlapStartMsBeforeEnd, input.onOverlapStart);
  }

  async duckMusicVolume(target = 0.34, fadeMs = 280): Promise<void> {
    const current = await getAppleMusicVolume().catch(() => 1);
    this.musicBaseVolume = current;
    await this.fadeVolume(current, Math.max(0.1, target), fadeMs);
  }

  async restoreMusicVolume(fadeMs = 300): Promise<void> {
    const current = await getAppleMusicVolume().catch(() => this.musicBaseVolume);
    await this.fadeVolume(current, this.musicBaseVolume, fadeMs);
  }

  private async fadeVolume(from: number, to: number, durationMs: number): Promise<void> {
    if (typeof window === "undefined") {
      await setAppleMusicVolume(to).catch(() => {});
      return;
    }

    if (this.activeFadeRaf) {
      window.cancelAnimationFrame(this.activeFadeRaf);
      this.activeFadeRaf = null;
    }

    const start = performance.now();
    await new Promise<void>((resolve) => {
      const step = () => {
        const now = performance.now();
        const progress = Math.min(1, (now - start) / Math.max(1, durationMs));
        const next = from + (to - from) * progress;
        void setAppleMusicVolume(next).catch(() => {});
        if (progress >= 1) {
          this.activeFadeRaf = null;
          resolve();
          return;
        }
        this.activeFadeRaf = window.requestAnimationFrame(step);
      };
      this.activeFadeRaf = window.requestAnimationFrame(step);
    });
  }

  private async playRemote(input: VoicePlayInput): Promise<VoiceResult> {
    try {
      const response = await fetch("/api/dj/voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          djId: input.djId,
          text: input.text,
        }),
      });

      if (!response.ok) {
        return { started: false, completed: false, durationMs: 0 };
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      audio.preload = "auto";

      this.djAudio = audio;
      this.djAudioUrl = objectUrl;

      return await new Promise<VoiceResult>((resolve) => {
        let started = false;
        let completed = false;
        let overlapTriggered = false;
        let overlapTimeoutId: number | null = null;

        const finalize = () => {
          if (overlapTimeoutId !== null) {
            window.clearTimeout(overlapTimeoutId);
          }
          const durationMs = Number.isFinite(audio.duration) && audio.duration > 0
            ? Math.round(audio.duration * 1000)
            : estimateSpeechDurationMs(input.text);
          this.cleanupAudio(audio, objectUrl);
          resolve({ started, completed, durationMs });
        };

        const maybeScheduleOverlap = () => {
          if (overlapTriggered || !input.onOverlapStart) {
            return;
          }
          const durationMs = Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration * 1000
            : estimateSpeechDurationMs(input.text);
          const overlapLead = Math.max(0, input.overlapStartMsBeforeEnd ?? 0);
          const fireAfter = Math.max(0, durationMs - overlapLead);
          overlapTimeoutId = window.setTimeout(() => {
            if (overlapTriggered) {
              return;
            }
            overlapTriggered = true;
            void input.onOverlapStart?.();
          }, fireAfter);
        };

        audio.onloadedmetadata = () => {
          maybeScheduleOverlap();
        };
        audio.onplaying = () => {
          started = true;
          maybeScheduleOverlap();
        };
        audio.onended = () => {
          completed = true;
          finalize();
        };
        audio.onerror = () => {
          finalize();
        };

        void audio.play().catch(() => {
          finalize();
        });
      });
    } catch {
      return { started: false, completed: false, durationMs: 0 };
    }
  }

  private async playLocal(
    text: string,
    overlapStartMsBeforeEnd?: number,
    onOverlapStart?: () => Promise<void> | void
  ): Promise<VoiceResult> {
    if (typeof window === "undefined" || typeof SpeechSynthesisUtterance === "undefined") {
      return { started: false, completed: false, durationMs: 0 };
    }
    const synth = window.speechSynthesis;
    if (!synth) {
      return { started: false, completed: false, durationMs: 0 };
    }

    synth.cancel();

    return await new Promise<VoiceResult>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      let started = false;
      let completed = false;
      const timeoutMs = estimateSpeechDurationMs(text) + 1200;
      let overlapTriggered = false;
      let overlapTimeoutId: number | null = null;
      const timeout = window.setTimeout(() => {
        synth.cancel();
        if (overlapTimeoutId !== null) {
          window.clearTimeout(overlapTimeoutId);
        }
        resolve({ started, completed, durationMs: timeoutMs });
      }, timeoutMs);

      utterance.onstart = () => {
        started = true;
        if (onOverlapStart) {
          const overlapLead = Math.max(0, overlapStartMsBeforeEnd ?? 0);
          const fireAfter = Math.max(0, timeoutMs - overlapLead);
          overlapTimeoutId = window.setTimeout(() => {
            if (overlapTriggered) {
              return;
            }
            overlapTriggered = true;
            void onOverlapStart();
          }, fireAfter);
        }
      };
      utterance.onend = () => {
        completed = true;
        window.clearTimeout(timeout);
        if (overlapTimeoutId !== null) {
          window.clearTimeout(overlapTimeoutId);
        }
        resolve({ started, completed, durationMs: timeoutMs });
      };
      utterance.onerror = () => {
        window.clearTimeout(timeout);
        if (overlapTimeoutId !== null) {
          window.clearTimeout(overlapTimeoutId);
        }
        resolve({ started, completed, durationMs: timeoutMs });
      };
      synth.speak(utterance);
    });
  }

  private cleanupAudio(audio: HTMLAudioElement, objectUrl: string): void {
    if (this.djAudio === audio) {
      this.djAudio = null;
    }
    if (this.djAudioUrl === objectUrl) {
      this.djAudioUrl = null;
    }
    URL.revokeObjectURL(objectUrl);
  }

  private stopDjAudio(): void {
    if (this.djAudio) {
      try {
        this.djAudio.pause();
      } catch {
        // no-op
      }
      this.djAudio.currentTime = 0;
      this.djAudio = null;
    }
    if (this.djAudioUrl) {
      URL.revokeObjectURL(this.djAudioUrl);
      this.djAudioUrl = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}
