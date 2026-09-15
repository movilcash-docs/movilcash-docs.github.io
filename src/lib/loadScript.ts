const loadedScripts = new Map<string, Promise<void>>()

export function loadScript(src: string): Promise<void> {
  const cached = loadedScripts.get(src)
  if (cached) return cached

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })

  loadedScripts.set(src, promise)
  return promise
}
