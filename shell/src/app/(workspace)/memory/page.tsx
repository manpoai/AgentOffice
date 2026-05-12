'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { WorkspacePageWrapper } from '@/components/WorkspacePageWrapper';
import { MemoryDetailPanel } from '@/components/MemoryDetailPanel';

export default function MemoryPage() {
  const [docListVisible, setDocListVisible] = useState(true);

  return (
    <WorkspacePageWrapper routeTab="memory" routeSelectedMemoryAgentId={null}>
      <MemoryDetailPanel
        selectedAgentId={null}
        docListVisible={docListVisible}
        onToggleDocList={() => setDocListVisible(v => !v)}
      />
    </WorkspacePageWrapper>
  );
}
