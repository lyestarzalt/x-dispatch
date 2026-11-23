const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Text made safe to place in HTML or XML/SVG, as content or inside a quoted
 * attribute. The apostrophe is a numeric reference because `&apos;` is not
 * HTML 4, and the numeric form is valid in both.
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
}
