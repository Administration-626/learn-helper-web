/**
 * Normalizes CJK delimiter boundaries for CommonMark parsers.
 * - Swaps quotes/brackets placed inside bold tags (e.g. `**“左右法”**` -> `“**左右法**”`)
 *   because CommonMark specification (§6.2) forbids delimiter runs preceded by alphanumeric/CJK
 *   and immediately followed by punctuation without whitespace.
 * - Fixes edge case where bold text ending with punctuation (e.g. `**范式（Normal Forms）**概念`)
 *   fails to close under CommonMark specifications unless space-delimited.
 */
export function formatCjkMarkdown(text: string): string {
  if (!text) return "";

  let formatted = text;

  // 1. Move opening & closing quote/bracket punctuation outside the asterisks:
  // e.g. **“左右法”** -> “**左右法**”
  // e.g. **《教程》** -> 《**教程**》
  // e.g. **【考点】** -> 【**考点**】
  // e.g. **（闭包）** -> （**闭包**）
  // e.g. **「重点」** -> 「**重点**」
  formatted = formatted.replace(/\*\*([“"《【（(「『‘'])([^*]+?)([”"》】）)」』’'])\*\*/g, "$1**$2**$3");

  // 2. Fix bold text ending with punctuation immediately followed by CJK character:
  // e.g. **范式（Normal Forms）**概念 -> **范式（Normal Forms）** 概念
  formatted = formatted.replace(/([)）\]】"”’'》」』])\*\*([\u4e00-\u9fa5a-zA-Z0-9])/g, "$1** $2");

  return formatted;
}

