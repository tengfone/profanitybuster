export function inferLikelyLanguageCodes(text: string): string[] {
  const result: string[] = [];
  const push = (code: string): void => {
    if (!result.includes(code)) result.push(code);
  };
  // CJK Unified Ideographs -> zh
  if (/[\u4E00-\u9FFF]/u.test(text)) push('zh');
  // Hiragana/Katakana -> ja
  if (/[\u3040-\u309F\u30A0-\u30FF]/u.test(text)) push('ja');
  // Hangul -> ko
  if (/[\uAC00-\uD7AF]/u.test(text)) push('ko');
  // Cyrillic -> ru
  if (/[\u0400-\u04FF]/u.test(text)) push('ru');
  // Arabic -> ar/fa
  if (/[\u0600-\u06FF]/u.test(text)) {
    push('ar');
    push('fa');
  }
  // Hebrew -> he (pack may not exist)
  if (/[\u0590-\u05FF]/u.test(text)) push('he');
  // Devanagari -> hi
  if (/[\u0900-\u097F]/u.test(text)) push('hi');
  // Thai -> th
  if (/[\u0E00-\u0E7F]/u.test(text)) push('th');
  return result;
}
