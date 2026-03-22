// Stub for Outline's CustomEmoji component
import * as React from 'react';
export default function CustomEmoji({ emoji, size = 16 }: { emoji?: string; size?: number }) {
  return <span style={{ fontSize: size }}>{emoji || ''}</span>;
}
