import type { RefObject } from "react";

export function TextEditor({
  refObject,
  text,
  textScale,
  disabled,
  onChange,
  onDoubleClick,
}: {
  refObject: RefObject<HTMLTextAreaElement | null>;
  text: string;
  textScale: number;
  disabled: boolean;
  onChange: (value: string) => void;
  onDoubleClick: (cursor: number) => void;
}) {
  return (
    <textarea
      ref={refObject}
      value={text}
      onChange={(event) => onChange(event.target.value)}
      onDoubleClick={(event) => onDoubleClick(event.currentTarget.selectionStart ?? 0)}
      style={{ fontSize: `calc(clamp(2rem, 6vw, 6.25rem) * ${textScale})`, lineHeight: 0.9 }}
      className="absolute inset-0 h-full w-full resize-none bg-transparent font-mono font-light tracking-tighter outline-none placeholder-gray-200"
      placeholder="Napište text zde..."
      spellCheck={false}
      disabled={disabled}
    />
  );
}
