declare module 'pagedjs' {
  export class Previewer {
    constructor(options?: unknown)
    preview(
      content?: string | Node,
      stylesheets?: (string | Record<string, string>)[],
      renderTo?: Element,
    ): Promise<{ pages: unknown[]; performance: number; size: unknown }>
  }
}
