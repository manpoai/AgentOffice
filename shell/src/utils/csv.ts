// Stub for Outline's utils/csv
export function parseCsv(text: string): string[][] {
  return text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
}
