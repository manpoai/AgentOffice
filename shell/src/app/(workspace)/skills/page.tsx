'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { WorkspacePageWrapper } from '@/components/WorkspacePageWrapper';
import { SkillDetailPanel } from '@/components/SkillDetailPanel';

export default function SkillsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedSkillId = searchParams.get('id');
  const sourceFilter = searchParams.get('source') || '';
  const [docListVisible, setDocListVisible] = useState(true);

  const handleSelectSkill = useCallback((id: string | null) => {
    const params = new URLSearchParams();
    if (id) params.set('id', id);
    if (sourceFilter) params.set('source', sourceFilter);
    const qs = params.toString();
    router.push(qs ? `/skills?${qs}` : '/skills');
  }, [router, sourceFilter]);

  return (
    <WorkspacePageWrapper routeTab="skills" routeSelectedSkillId={selectedSkillId}>
      <SkillDetailPanel
        selectedSkillId={selectedSkillId}
        onSelectSkill={handleSelectSkill}
        sourceFilter={sourceFilter}
        docListVisible={docListVisible}
        onToggleDocList={() => setDocListVisible(v => !v)}
      />
    </WorkspacePageWrapper>
  );
}
