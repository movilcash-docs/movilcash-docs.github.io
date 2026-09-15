export interface EditorSelection {
  value: string
  selectionStart: number
  selectionEnd: number
}

/** Wraps the selection with `before`/`after` (e.g. bold, italic, inline code). */
export function wrapSelection(sel: EditorSelection, before: string, after: string = before): EditorSelection {
  const { value, selectionStart: start, selectionEnd: end } = sel
  const selected = value.slice(start, end) || 'texto'
  const value2 = value.slice(0, start) + before + selected + after + value.slice(end)
  const selectionStart = start + before.length
  return { value: value2, selectionStart, selectionEnd: selectionStart + selected.length }
}

function lineBounds(value: string, start: number, end: number): { lineStart: number; lineEnd: number } {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const nextBreak = value.indexOf('\n', end)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  return { lineStart, lineEnd }
}

/** Toggles a per-line prefix (blockquote, bullet/numbered/checklist) over every line touched by the selection. */
export function togglePrefixLines(sel: EditorSelection, prefix: string): EditorSelection {
  const { value, selectionStart: start, selectionEnd: end } = sel
  const { lineStart, lineEnd } = lineBounds(value, start, end)
  const block = value.slice(lineStart, lineEnd)
  const lines = block.split('\n')
  const allPrefixed = lines.every((line) => line.startsWith(prefix))

  const newLines = lines.map((line) => (allPrefixed ? line.slice(prefix.length) : prefix + line))
  const newBlock = newLines.join('\n')
  const value2 = value.slice(0, lineStart) + newBlock + value.slice(lineEnd)
  const delta = newBlock.length - block.length

  return { value: value2, selectionStart: lineStart, selectionEnd: lineEnd + delta }
}

/** Sets (or clears, if already at that level) a heading level on every line touched by the selection. */
export function setHeadingLevel(sel: EditorSelection, level: 1 | 2 | 3): EditorSelection {
  const { value, selectionStart: start, selectionEnd: end } = sel
  const { lineStart, lineEnd } = lineBounds(value, start, end)
  const block = value.slice(lineStart, lineEnd)
  const marker = '#'.repeat(level) + ' '

  const newLines = block.split('\n').map((line) => {
    const stripped = line.replace(/^#{1,6}\s+/, '')
    return line.startsWith(marker) ? stripped : marker + stripped
  })
  const newBlock = newLines.join('\n')
  const value2 = value.slice(0, lineStart) + newBlock + value.slice(lineEnd)
  const delta = newBlock.length - block.length

  return { value: value2, selectionStart: lineStart, selectionEnd: lineEnd + delta }
}

/** Wraps the selection in a fenced code block on its own lines. */
export function insertCodeBlock(sel: EditorSelection): EditorSelection {
  const { value, selectionStart: start, selectionEnd: end } = sel
  const selected = value.slice(start, end) || 'código'
  const insert = '```\n' + selected + '\n```'
  const value2 = value.slice(0, start) + insert + value.slice(end)
  return { value: value2, selectionStart: start + 4, selectionEnd: start + 4 + selected.length }
}

/** Inserts `[texto](url)`, using the current selection as the link text when there is one. */
export function insertLink(sel: EditorSelection): EditorSelection {
  const { value, selectionStart: start, selectionEnd: end } = sel
  const text = value.slice(start, end) || 'texto'
  const insert = `[${text}](url)`
  const value2 = value.slice(0, start) + insert + value.slice(end)
  const urlStart = start + text.length + 3
  return { value: value2, selectionStart: urlStart, selectionEnd: urlStart + 3 }
}

/** Inserts a starter markdown table at the cursor. */
export function insertTable(sel: EditorSelection): EditorSelection {
  const { value, selectionStart: start } = sel
  const table = '| Columna 1 | Columna 2 |\n| --- | --- |\n| valor | valor |\n'
  const value2 = value.slice(0, start) + table + value.slice(start)
  return { value: value2, selectionStart: start + table.length, selectionEnd: start + table.length }
}

/** Inserts a horizontal rule at the cursor, on its own blank-line-separated block. */
export function insertHorizontalRule(sel: EditorSelection): EditorSelection {
  const { value, selectionStart: start } = sel
  const insert = '\n\n---\n\n'
  const value2 = value.slice(0, start) + insert + value.slice(start)
  const pos = start + insert.length
  return { value: value2, selectionStart: pos, selectionEnd: pos }
}

const INDENT = '  '

/** Indents every line touched by the selection by one step (used for Tab with a selection). */
export function indentLines(sel: EditorSelection): EditorSelection {
  const { value, selectionStart: start, selectionEnd: end } = sel
  const { lineStart, lineEnd } = lineBounds(value, start, end)
  const block = value.slice(lineStart, lineEnd)
  const newBlock = block
    .split('\n')
    .map((line) => INDENT + line)
    .join('\n')
  const value2 = value.slice(0, lineStart) + newBlock + value.slice(lineEnd)
  const delta = newBlock.length - block.length
  return { value: value2, selectionStart: start + INDENT.length, selectionEnd: end + delta }
}

/** Outdents every line touched by the selection by up to one step (used for Shift+Tab). */
export function outdentLines(sel: EditorSelection): EditorSelection {
  const { value, selectionStart: start, selectionEnd: end } = sel
  const { lineStart, lineEnd } = lineBounds(value, start, end)
  const block = value.slice(lineStart, lineEnd)
  let firstLineRemoved = 0

  const newLines = block.split('\n').map((line, i) => {
    const removed = line.startsWith('\t') ? 1 : (line.match(/^ {1,2}/)?.[0].length ?? 0)
    if (i === 0) firstLineRemoved = removed
    return line.slice(removed)
  })
  const newBlock = newLines.join('\n')
  const value2 = value.slice(0, lineStart) + newBlock + value.slice(lineEnd)
  const delta = newBlock.length - block.length

  return { value: value2, selectionStart: Math.max(lineStart, start - firstLineRemoved), selectionEnd: end + delta }
}
