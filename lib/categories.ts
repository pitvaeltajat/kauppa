/** Categories owned by the application rather than editable catalog content. */
export const SYSTEM_CATEGORY_SLUGS = ['tapahtumat'] as const;

export function isSystemCategorySlug(slug: string): boolean {
  return (SYSTEM_CATEGORY_SLUGS as readonly string[]).includes(slug);
}
