/** Presentation-only filtering. Archive data and analysis stay unchanged. */
export function withoutEmoji(text: string): string {
  return text.replace(/(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|[\u200d\ufe0f\u20e3])/gu, "").trim() || "[Emoji omitted]";
}
