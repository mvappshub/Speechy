import type { Voice } from "../domain/types";

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
    <div className="space-y-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
        <label>Hlas</label>
      </div>
      <select value={selectedVoice} onChange={(event) => onVoiceChange(event.target.value)} disabled={disabled} className="w-full border border-gray-300 bg-white px-3 py-3 text-sm">
        {voices.map((voice) => (
          <option key={voice.name} value={voice.name}>
            {voice.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={onUploadClick} disabled={disabled || uploading} className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-500 hover:text-black disabled:opacity-40">
        <span>{uploading ? "…" : "+"}</span>
        Přidat hlas
      </button>
    </div>
  );
}
