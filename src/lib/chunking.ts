export type PlaybackChunk = {
  index: number
  text: string
  start: number
  end: number
}

const SENTENCE_RE = /[^.!?…\n]+(?:[.!?…]+|$)/g

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function splitOversizedSentence(
  sentence: string,
  startOffset: number,
  maxChars: number,
): Array<{ text: string; start: number; end: number }> {
  const raw = sentence
  const normalized = normalizeWhitespace(raw)
  if (!normalized) return []
  if (normalized.length <= maxChars) {
    const start = startOffset + raw.search(/\S|$/)
    return [{ text: normalized, start, end: startOffset + raw.length }]
  }

  const parts = raw.split(/([,;:])/)
  const chunks: Array<{ text: string; start: number; end: number }> = []
  let currentText = ""
  let currentStart = startOffset
  let currentEnd = startOffset
  let runningOffset = startOffset

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i] ?? ""
    const next = parts[i + 1] ?? ""
    let token = part
    let consumed = part.length
    if (next && [",", ";", ":"].includes(next)) {
      token += next
      consumed += next.length
      i += 1
    }

    const trimmed = normalizeWhitespace(token)
    const tokenStart = runningOffset + token.search(/\S|$/)
    const tokenEnd = runningOffset + token.length
    runningOffset += consumed
    if (!trimmed) continue

    const candidate = normalizeWhitespace(`${currentText} ${trimmed}`)
    if (currentText && candidate.length > maxChars) {
      chunks.push({ text: currentText, start: currentStart, end: currentEnd })
      currentText = trimmed
      currentStart = tokenStart
      currentEnd = tokenEnd
    } else {
      currentText = candidate
      currentStart = currentText === trimmed ? tokenStart : currentStart
      currentEnd = tokenEnd
    }
  }

  if (currentText) {
    chunks.push({ text: currentText, start: currentStart, end: currentEnd })
  }

  return chunks
}

export function splitTextIntoPlaybackChunks(text: string, maxChars = 170): PlaybackChunk[] {
  const normalized = text.replace(/\r\n/g, "\n")
  if (!normalized.trim()) return []

  const chunks: PlaybackChunk[] = []
  const paragraphs = normalized.split(/\n\s*\n/g)
  let searchOffset = 0

  paragraphs.forEach((paragraph) => {
    if (!paragraph.trim()) {
      searchOffset += paragraph.length + 2
      return
    }

    const paragraphStart = normalized.indexOf(paragraph, searchOffset)
    searchOffset = paragraphStart + paragraph.length

    const sentences = Array.from(paragraph.matchAll(SENTENCE_RE))
    let currentText = ""
    let currentStart = paragraphStart
    let currentEnd = paragraphStart

    sentences.forEach((match) => {
      const rawSentence = match[0] ?? ""
      const sentenceOffset = paragraphStart + (match.index ?? 0)
      const parts = splitOversizedSentence(rawSentence, sentenceOffset, maxChars)

      parts.forEach((part) => {
        const candidate = normalizeWhitespace(`${currentText} ${part.text}`)
        if (currentText && candidate.length > maxChars) {
          chunks.push({
            index: chunks.length,
            text: currentText,
            start: currentStart,
            end: currentEnd,
          })
          currentText = part.text
          currentStart = part.start
          currentEnd = part.end
        } else {
          currentText = candidate
          currentStart = currentText === part.text ? part.start : currentStart
          currentEnd = part.end
        }
      })
    })

    if (currentText) {
      chunks.push({
        index: chunks.length,
        text: currentText,
        start: currentStart,
        end: currentEnd,
      })
    }
  })

  return chunks
}
