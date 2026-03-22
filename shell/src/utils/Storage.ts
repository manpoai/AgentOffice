// Stub for Outline's utils/Storage
class Storage {
  get(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try { return localStorage.getItem(key); } catch { return null; }
  }
  set(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(key, value); } catch {}
  }
  remove(key: string): void {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(key); } catch {}
  }
}
export default new Storage();
