// URL-safe slugs from user-entered names. Finnish diacritics are stripped
// (ä -> a, ö -> o) so "PitVa-huivi" becomes "pitva-huivi".

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'tuote';
}
