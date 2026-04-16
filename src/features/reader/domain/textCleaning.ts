export function cleanReaderText(text: string) {
  return text
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/^[>\-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[|~^<>{}\[\]\\]/g, " ")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
