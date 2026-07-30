/**
 * Inicia la descarga de un archivo binario recibido desde un endpoint autorizado.
 * La URL temporal sólo existe durante la operación y se revoca inmediatamente
 * después para no mantener referencias innecesarias en memoria.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const downloadUrl = window.URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");

  downloadLink.href = downloadUrl;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
