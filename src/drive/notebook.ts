export interface NotebookOutput {
  output_type: 'stream' | 'execute_result' | 'display_data' | 'error'
  text?: string[] | string
  data?: Record<string, string[] | string>
  ename?: string
  evalue?: string
  traceback?: string[]
}

export interface NotebookCell {
  cell_type: 'markdown' | 'code' | 'raw'
  source: string[] | string
  outputs?: NotebookOutput[]
}

export interface NotebookDoc {
  cells: NotebookCell[]
}

export function joinSource(source: string[] | string | undefined): string {
  if (!source) return ''
  return Array.isArray(source) ? source.join('') : source
}

export function parseNotebook(rawJson: string): NotebookDoc {
  const parsed = JSON.parse(rawJson) as { cells?: NotebookCell[] }
  return { cells: parsed.cells ?? [] }
}
