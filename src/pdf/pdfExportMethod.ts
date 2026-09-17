import { useState } from 'react'

/** 1 = plain window.print(), 2 = Paged.js preview, 3 = jsPDF + html2canvas. */
export type PdfExportMethod = '1' | '2' | '3'

const STORAGE_KEY = 'wiki.pdfExportMethod'
const DEFAULT_METHOD: PdfExportMethod = '3'

function isValidMethod(value: string | null): value is PdfExportMethod {
  return value === '1' || value === '2' || value === '3'
}

function getStoredMethod(): PdfExportMethod {
  const stored = localStorage.getItem(STORAGE_KEY)
  return isValidMethod(stored) ? stored : DEFAULT_METHOD
}

/** Lets us compare the three PDF-export approaches side by side; the choice persists per browser. */
export function usePdfExportMethod(): [PdfExportMethod, (method: PdfExportMethod) => void] {
  const [method, setMethodState] = useState<PdfExportMethod>(getStoredMethod)

  function setMethod(next: PdfExportMethod) {
    localStorage.setItem(STORAGE_KEY, next)
    setMethodState(next)
  }

  return [method, setMethod]
}
