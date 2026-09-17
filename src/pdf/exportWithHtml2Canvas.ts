import html2canvas from 'html2canvas-pro'
import { jsPDF } from 'jspdf'

/**
 * Alternative PDF export: screenshots the rendered page (via html2canvas) and slices that raster
 * image across A4 pages (via jsPDF). Unlike the Paged.js path, this has no idea where
 * headings/paragraphs/images actually are, so a page break can land mid-line or mid-image, and the
 * output is a picture of the text — not real, selectable/searchable text. Kept for comparison.
 */
export async function exportPdfWithHtml2Canvas(html: string, title: string): Promise<void> {
  const wasDark = document.documentElement.classList.contains('dark')
  document.documentElement.classList.remove('dark')

  const container = document.createElement('div')
  container.className = 'pdf-capture-root prose mx-auto max-w-3xl'
  container.style.position = 'fixed'
  container.style.top = '0'
  container.style.left = '-99999px'
  container.style.width = '794px'
  container.style.background = '#ffffff'
  container.style.padding = '40px'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    // Let images/fonts inside the clone finish loading before we screenshot it.
    await new Promise((resolve) => setTimeout(resolve, 100))

    const canvas = await html2canvas(container, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#ffffff',
    })

    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidthMm = pdf.internal.pageSize.getWidth()
    const pageHeightMm = pdf.internal.pageSize.getHeight()
    // How many source-canvas pixels correspond to one PDF page's height, at this image's scale.
    const pxPerMm = canvas.width / pageWidthMm
    const pageHeightPx = Math.round(pageHeightMm * pxPerMm)

    // Slice the (possibly very tall) screenshot into one canvas per page and embed each as its
    // own compressed JPEG — reusing one giant PNG across every `addImage` call instead blew up to
    // ~50MB for a handful of pages, since nothing here shares image data between pages.
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = canvas.width
    const pageCtx = pageCanvas.getContext('2d')
    if (!pageCtx) throw new Error('No se pudo preparar el canvas de exportación.')

    let sourceY = 0
    let pageIndex = 0
    while (sourceY < canvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - sourceY)
      pageCanvas.height = sliceHeightPx

      pageCtx.fillStyle = '#ffffff'
      pageCtx.fillRect(0, 0, pageCanvas.width, sliceHeightPx)
      pageCtx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx)

      const sliceImgData = pageCanvas.toDataURL('image/jpeg', 0.85)
      const sliceHeightMm = (sliceHeightPx * pageWidthMm) / canvas.width

      if (pageIndex > 0) pdf.addPage()
      pdf.addImage(sliceImgData, 'JPEG', 0, 0, pageWidthMm, sliceHeightMm)

      sourceY += sliceHeightPx
      pageIndex++
    }

    pdf.save(`${title}.pdf`)
  } finally {
    document.body.removeChild(container)
    if (wasDark) document.documentElement.classList.add('dark')
  }
}
