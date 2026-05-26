/** Renderer-safe URL for the vac-pdf:// custom protocol (handler registered in main). */
export function vacPdfPreviewUrl(icao: string): string {
  return `vac-pdf://${icao.toUpperCase()}/chart.pdf`;
}
