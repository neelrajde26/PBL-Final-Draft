"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, Square, Volume2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface SpeakButtonProps {
  textToSpeak: string;
  className?: string;
  title?: string;
}

export function SpeakButton({ textToSpeak, className = "", title }: SpeakButtonProps) {
  const { language, t } = useI18n();
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hasMarathiVoice, setHasMarathiVoice] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setSupported(true);
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        const foundMr = voices.some(
          (v) => v.lang.toLowerCase().startsWith("mr") || v.name.toLowerCase().includes("marathi")
        );
        setHasMarathiVoice(foundMr);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const handleSpeak = () => {
    if (!supported || !textToSpeak.trim()) return;

    if (speaking && paused) {
      window.speechSynthesis.resume();
      setPaused(false);
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setPaused(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utteranceRef.current = utterance;

    // Detect language code
    if (language === "mr") {
      utterance.lang = "mr-IN";
      const mrVoice = window.speechSynthesis
        .getVoices()
        .find(
          (v) => v.lang.toLowerCase().startsWith("mr") || v.name.toLowerCase().includes("marathi")
        );
      if (mrVoice) {
        utterance.voice = mrVoice;
      }
    } else {
      utterance.lang = "en-IN";
    }

    utterance.rate = 0.95; // Slightly slower for clear agricultural comprehension
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setSpeaking(true);
      setPaused(false);
    };

    utterance.onend = () => {
      setSpeaking(false);
      setPaused(false);
    };

    utterance.onerror = (e) => {
      console.warn("SpeechSynthesis error:", e);
      setSpeaking(false);
      setPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handlePause = () => {
    if (!supported || !speaking) return;
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  };

  const handleStop = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  };

  if (!supported) {
    return (
      <span className="text-xs text-[var(--subtle)] italic">
        (आवाज वाचन उपलब्ध नाही / Speech not supported)
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`} role="region" aria-label="Audio reader controls">
      <button
        type="button"
        onClick={handleSpeak}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
          speaking
            ? "bg-[var(--aqua)] text-[var(--ground)] hover:bg-[#48bca6]"
            : "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--raised)]"
        }`}
        title={title || t("farmer.listen")}
        aria-label={speaking ? t("farmer.stopListening") : t("farmer.listen")}
      >
        <Volume2 size={15} className={speaking ? "animate-pulse" : ""} />
        <span>{speaking ? (paused ? t("farmer.resumeListening") : t("farmer.readingAloud")) : t("farmer.listen")}</span>
      </button>

      {speaking && (
        <>
          <button
            type="button"
            onClick={handlePause}
            className="p-1.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--secondary)] hover:text-[var(--text)]"
            title={paused ? t("farmer.resumeListening") : t("farmer.pauseListening")}
            aria-label={paused ? t("farmer.resumeListening") : t("farmer.pauseListening")}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button
            type="button"
            onClick={handleStop}
            className="p-1.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--negative)] hover:bg-[#ffedea]"
            title={t("farmer.stopListening")}
            aria-label={t("farmer.stopListening")}
          >
            <Square size={13} />
          </button>
        </>
      )}

      {speaking && language === "mr" && !hasMarathiVoice && (
        <span className="sr-only" role="status">
          {t("farmer.voiceUnavailable")}
        </span>
      )}
    </div>
  );
}

