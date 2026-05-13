'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { WorkspacePageWrapper } from '@/components/WorkspacePageWrapper';
import { MemoryDetailPanel } from '@/components/MemoryDetailPanel';

export default function MemoryPage() {
  const searchParams = useSearchParams();
  const selectedAgentId = searchParams.get('id');
  const [docListVisible, setDocListVisible] = useState(true);

  return (
    <WorkspacePageWrapper routeTab="memory" routeSelectedMemoryAgentId={selectedAgentId}>
      <MemoryDetailPanel
        selectedAgentId={selectedAgentId}
        docListVisible={docListVisible}
        onToggleDocList={() => setDocListVisible(v => !v)}
      />
    </WorkspacePageWrapper>
  );
}
