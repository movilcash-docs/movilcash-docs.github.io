/** Turns a file name into a URL-friendly slug, purely cosmetic — links are still resolved by id. */
export function slugifyForUrl(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
