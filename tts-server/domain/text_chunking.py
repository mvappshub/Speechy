"""
Helpers for splitting long Czech text into stable render blocks.
"""

from __future__ import annotations

import re

SENTENCE_RE = re.compile(r"[^.!?…\n]+(?:[.!?…]+|$)", re.UNICODE)


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _split_oversized_sentence(sentence: str, max_chars: int) -> list[str]:
    sentence = _normalize_text(sentence)
    if len(sentence) <= max_chars:
        return [sentence] if sentence else []

    parts = re.split(r"([,;:])", sentence)
    chunks: list[str] = []
    current = ""

    index = 0
    while index < len(parts):
        token = parts[index].strip()
        if not token:
            index += 1
            continue

        if index + 1 < len(parts) and parts[index + 1] in {",", ";", ":"}:
            token = f"{token}{parts[index + 1]}"
            index += 1

        candidate = f"{current} {token}".strip()
        if current and len(candidate) > max_chars:
            chunks.append(current)
            current = token
        else:
            current = candidate
        index += 1

    if current:
        chunks.append(current)

    final_chunks: list[str] = []
    for chunk in chunks:
        if len(chunk) <= max_chars:
            final_chunks.append(chunk)
            continue

        words = chunk.split()
        current_words: list[str] = []
        for word in words:
            candidate = " ".join([*current_words, word]).strip()
            if current_words and len(candidate) > max_chars:
                final_chunks.append(" ".join(current_words))
                current_words = [word]
            else:
                current_words.append(word)
        if current_words:
            final_chunks.append(" ".join(current_words))

    return [chunk for chunk in final_chunks if chunk]


def split_text_into_chunks(text: str, max_chars: int = 260) -> list[str]:
    normalized = text.replace("\r\n", "\n").strip()
    if not normalized:
        return []

    paragraphs = [paragraph.strip() for paragraph in re.split(r"\n\s*\n", normalized) if paragraph.strip()]
    chunks: list[str] = []

    for paragraph in paragraphs:
        sentences = [
            _normalize_text(sentence)
            for sentence in SENTENCE_RE.findall(paragraph)
            if _normalize_text(sentence)
        ]
        current = ""

        for sentence in sentences:
            for part in _split_oversized_sentence(sentence, max_chars):
                candidate = f"{current} {part}".strip()
                if current and len(candidate) > max_chars:
                    chunks.append(current)
                    current = part
                else:
                    current = candidate

        if current:
            chunks.append(current)

    return chunks


__all__ = ["split_text_into_chunks"]
