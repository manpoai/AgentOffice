'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { WorkspacePageWrapper } from '@/components/WorkspacePageWrapper';
import { MemoryDetailPanel } from '@/components/MemoryDetailPanel';

export default function MemoryAgentPage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const [docListVisible, setDocListVisible] = useState(true);

  return (
    <WorkspacePageWrapper routeTab="memory" routeSelectedMemoryAgentId={agentId}>
      <MemoryDetailPanel
        selectedAgentId={agentId}
        docListVisible={docListVisible}
        onToggleDocList={() => setDocListVisible(v => !v)}
      />
    </WorkspacePageWrapper>
  );
}
