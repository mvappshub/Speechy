"use client";

import { useEffect, useMemo, useRef } from "react";
import { Menu, Upload } from "lucide-react";
import type { Voice } from "../domain/types";

function formatVoiceLabel(value: string | undefined) {
  return (value ?? "Hlas").replace(/\.wav$/i, "");
}

export function VoiceMenu({
  selectedVoice,
  voices,
  disabled,
  onVoiceChange,
  onUploadClick,
  uploading = false,
  open,
  onOpenChange,
  triggerLabel,
  title,
  align = "left",
}: {
  selectedVoice: string;
  voices: Voice[];
  disabled: boolean;
  onVoiceChange: (value: string) => void;
  onUploadClick?: () => void;
  uploading?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel?: string;
  title?: string;
  align?: "left" | "right";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeVoice = useMemo(
    () => voices.find((voice) => voice.name === selectedVoice) ?? voices[0] ?? null,
    [selectedVoice, voices],
  );

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [onOpenChange, open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        disabled={disabled}
        aria-expanded={open}
        className="frameless-action frameless-focus w-full justify-end gap-3 text-right"
        title={title}
      >
        <Menu className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate">{triggerLabel ?? formatVoiceLabel(activeVoice?.name)}</span>
      </button>

      {open ? (
        <div
          className={`reader-dropdown absolute top-full z-20 mt-2 min-w-[16rem] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="reader-dropdown-list">
            {voices.map((voice) => (
              <button
                key={voice.name}
                type="button"
                onClick={() => {
                  onVoiceChange(voice.name);
                  onOpenChange(false);
                }}
                data-active={voice.name === selectedVoice}
                className="reader-dropdown-item frameless-focus"
              >
                <span className="truncate">{formatVoiceLabel(voice.name)}</span>
                {voice.name === selectedVoice ? <span className="text-[10px] uppercase tracking-[0.2em]">Aktivní</span> : null}
              </button>
            ))}
            {onUploadClick ? (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onUploadClick();
                }}
                className="reader-dropdown-item frameless-focus border-t border-black/10"
              >
                <span>{uploading ? "Nahrávám hlas..." : "Přidat hlas..."}</span>
                <Upload className="h-3.5 w-3.5 shrink-0" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
