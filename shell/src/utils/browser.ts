// Stub for Outline's utils/browser
export const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
export const isWindows = typeof navigator !== 'undefined' && /Win/.test(navigator.platform);
export const isNode = typeof window === 'undefined';
export const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;
export const isAndroid = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent);
export const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
