/** Extract a literal public product/family name, never infer a catalog identity. */
export function catalogReference(question: string): string | null {
  const quoted = question.match(/["“]([^"”]{2,200})["”]/u)?.[1];
  const cleaned = question
    .trim()
    .replace(/^(?:(?:gói|sản phẩm|phần mềm|product)\s+)+/iu, '');
  const named = cleaned.match(
    /^(.{2,160}?)\s+(?:có\s+(?:(?:những|các)\s+)?(?:gói|tính năng)|(?:có\s+)?giá\s+(?:bao nhiêu|ra sao)|hỗ trợ\s+(?:gì|những gì|bao nhiêu)|là gì|dùng để làm gì)/iu,
  )?.[1];
  const bare =
    /^(?:sản phẩm|phần mềm|product)\s+/iu.test(question.trim()) &&
    !/[?!]/.test(cleaned) &&
    cleaned.split(/\s+/).length <= 5
      ? cleaned
      : undefined;
  const english =
    question.match(
      /(?:plans?|pricing|price)\s+(?:for|of)\s+(.{2,160}?)[?!.]*$/iu,
    )?.[1] ??
    question.match(/^does\s+(.{2,160}?)\s+(?:have|offer|support)\b/iu)?.[1];
  return (quoted ?? named ?? english ?? bare)?.trim().toLowerCase() ?? null;
}
