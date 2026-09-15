import { joinSource, type NotebookCell, type NotebookDoc, type NotebookOutput } from './notebook'
import { MarkdownView } from './MarkdownView'

interface NotebookViewProps {
  notebook: NotebookDoc
  accessToken: string
}

// Empty on purpose: notebook cells don't participate in the wiki's page/asset linking.
const EMPTY_PATH_INDEX = { pages: new Map(), assets: new Map() }

export function NotebookView({ notebook, accessToken }: NotebookViewProps) {
  return (
    <div className="flex flex-col gap-4">
      {notebook.cells.map((cell, i) => (
        <NotebookCellView key={i} cell={cell} accessToken={accessToken} />
      ))}
    </div>
  )
}

function NotebookCellView({ cell, accessToken }: { cell: NotebookCell; accessToken: string }) {
  const source = joinSource(cell.source)

  if (cell.cell_type === 'markdown') {
    return (
      <div className="prose dark:prose-invert max-w-none">
        <MarkdownView
          content={source}
          assets={[]}
          basePath={[]}
          pathIndex={EMPTY_PATH_INDEX}
          accessToken={accessToken}
          onSelectPage={() => {}}
        />
      </div>
    )
  }

  if (cell.cell_type === 'code') {
    return (
      <div className="flex flex-col gap-2">
        <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-sm">{source}</pre>
        {cell.outputs?.map((output, i) => <NotebookOutputView key={i} output={output} />)}
      </div>
    )
  }

  return <pre className="text-muted-foreground font-mono text-sm whitespace-pre-wrap">{source}</pre>
}

function NotebookOutputView({ output }: { output: NotebookOutput }) {
  if (output.output_type === 'stream') {
    return <pre className="overflow-x-auto rounded-md border p-3 font-mono text-sm">{joinSource(output.text)}</pre>
  }

  if (output.output_type === 'error') {
    return (
      <pre className="text-destructive overflow-x-auto rounded-md border p-3 font-mono text-sm">
        {output.ename}: {output.evalue}
        {output.traceback && '\n' + output.traceback.join('\n')}
      </pre>
    )
  }

  if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
    const data = output.data ?? {}
    const image = data['image/png'] ?? data['image/jpeg']
    if (image) {
      const mime = data['image/png'] ? 'image/png' : 'image/jpeg'
      return <img src={`data:${mime};base64,${joinSource(image).replace(/\n/g, '')}`} alt="" className="max-w-full" />
    }
    if (data['text/plain']) {
      return <pre className="overflow-x-auto rounded-md border p-3 font-mono text-sm">{joinSource(data['text/plain'])}</pre>
    }
    return (
      <p className="text-muted-foreground text-sm italic">
        (salida no soportada: {Object.keys(data).join(', ') || 'desconocida'})
      </p>
    )
  }

  return null
}
