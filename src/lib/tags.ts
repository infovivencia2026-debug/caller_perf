/**
 * SQLite has no array column, so Customer.tags is a single comma-separated string.
 * These are the only two places that know that — everything else works with string[].
 */
export function parseTags(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function serializeTags(tags: readonly string[]): string {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].join(",");
}
