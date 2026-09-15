import type { DriveFileAuthorship } from './driveApi'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function personLabel(person?: { displayName?: string; emailAddress?: string }): string | null {
  return person?.displayName ?? person?.emailAddress ?? null
}

interface PageBylineProps {
  authorship: DriveFileAuthorship | null
}

export function PageByline({ authorship }: PageBylineProps) {
  if (!authorship) return null

  const creator = personLabel(authorship.owners[0])
  const editor = personLabel(authorship.lastModifyingUser)
  const sameEditAsCreation = authorship.createdTime === authorship.modifiedTime

  return (
    <p className="text-muted-foreground mb-4 text-xs">
      {creator && (
        <>
          Creado por <span className="font-medium">{creator}</span> el {formatDate(authorship.createdTime)}
        </>
      )}
      {editor && !sameEditAsCreation && (
        <>
          {creator && ' · '}
          Última edición por <span className="font-medium">{editor}</span> el {formatDate(authorship.modifiedTime)}
        </>
      )}
    </p>
  )
}
