export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noreferrer'
  a.click()

  // Defer revoke so the download can start
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function openBlobInNewTab(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')

  // Can't know when the tab finished loading; keep it around briefly.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

