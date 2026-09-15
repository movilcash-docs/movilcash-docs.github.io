export function isAbsoluteUrl(href: string): boolean {
  return /^([a-z][a-z0-9+.-]*:)?\/\//i.test(href) || /^(mailto|tel|data):/i.test(href)
}
