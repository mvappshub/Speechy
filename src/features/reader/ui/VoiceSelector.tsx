import { useState } from "react";
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
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-2">
      <VoiceMenu
        selectedVoice={selectedVoice}
        voices={voices}
        disabled={disabled}
        onVoiceChange={onVoiceChange}
        open={open}
        onOpenChange={setOpen}
        title="Vybrat hlas"
      />

      <button
        type="button"
        onClick={onUploadClick}
        disabled={disabled || uploading}
        className="frameless-action frameless-focus"
      >
        <Upload className="h-3 w-3" />
        <span>{uploading ? "Nahrávám" : "Přidat hlas"}</span>
      </button>
    </div>
  );
}
