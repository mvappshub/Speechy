import { Upload } from "lucide-react";
import type { Voice } from "../domain/types";
import { VoiceMenu } from "./VoiceMenu";

export function VoiceSelector({
  selectedVoice,
  voices,
  disabled,
  uploading,
  onVoiceChange,
  onUploadClick,
}: {
  selectedVoice: string;
  voices: Voice[];
  disabled: boolean;
  uploading: boolean;
  onVoiceChange: (value: string) => void;
  onUploadClick: () => void;
}) {
  return (
    <div className="relative flex items-center gap-2">
      <VoiceMenu
        selectedVoice={selectedVoice}
        voices={voices}
        disabled={disabled}
        onVoiceChange={onVoiceChange}
        title="Vybrat hlas"
      />

      <button
        type="button"
        onClick={onUploadClick}
        disabled={disabled || uploading}
        className="inline-flex items-center gap-1 bg-black px-3 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Upload className="h-3 w-3" />
        <span>{uploading ? "Nahrávám" : "Přidat hlas"}</span>
      </button>
    </div>
  );
}
