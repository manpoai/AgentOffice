'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { WorkspacePageWrapper } from '@/components/WorkspacePageWrapper';
import { MemoryDetailPanel } from '@/components/MemoryDetailPanel';

export default function MemoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedAgentId = searchParams.get('id');
  const selectedMemoryId = searchParams.get('mem');
  const [docListVisible, setDocListVisible] = useState(true);

  const handleSelectMemory = useCallback((id: string | null) => {
    const params = new URLSearchParams();
    if (selectedAgentId) params.set('id', selectedAgentId);
    if (id) params.set('mem', id);
    const qs = params.toString();
    router.push(qs ? `/memory?${qs}` : '/memory');
  }, [router, selectedAgentId]);

  return (
    <WorkspacePageWrapper routeTab="memory" routeSelectedMemoryAgentId={selectedAgentId}>
      <MemoryDetailPanel
        selectedAgentId={selectedAgentId}
        selectedMemoryId={selectedMemoryId}
        onSelectMemory={handleSelectMemory}
        docListVisible={docListVisible}
        onToggleDocList={() => setDocListVisible(v => !v)}
      />
    </WorkspacePageWrapper>
  );
}
