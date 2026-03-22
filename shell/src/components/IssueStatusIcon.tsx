// Stub for Outline's IssueStatusIcon component
import * as React from 'react';
export default function IssueStatusIcon({ status }: { status?: string }) {
  return <span>{status || '•'}</span>;
}
