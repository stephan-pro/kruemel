// Hands a text to the browser as a file download.

export function downloadTextFile(fileName: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mimeType};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Safari needs the address a moment longer than the click.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
