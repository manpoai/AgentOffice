// Stub for Outline's utils/files
export function bytesToHumanReadable(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let b = bytes;
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(1)} ${units[i]}`;
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop() || '';
}
