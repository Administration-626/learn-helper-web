/**
 * Normalizes CJK delimiter boundaries for CommonMark parsers.
 * Fixes edge case where bold text ending with punctuation (e.g. `**范式（Normal Forms）**概念`)
 * fails to close under CommonMark specifications unless space-delimited.
 */
export function formatCjkMarkdown(text: string): string {
  if (!text) return "";
  return text.replace(/([)）\]】"”’'])\*\*([\u4e00-\u9fa5a-zA-Z0-9])/g, "$1** $2");
}
