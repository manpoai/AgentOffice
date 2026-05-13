'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { WorkspacePageWrapper } from '@/components/WorkspacePageWrapper';
import { SkillDetailPanel } from '@/components/SkillDetailPanel';

export default function SkillsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedSkillId = searchParams.get('id');
  const [docListVisible, setDocListVisible] = useState(true);

  const handleSelectSkill = useCallback((id: string | null) => {
    router.push(id ? `/skills?id=${id}` : '/skills');
  }, [router]);

  return (
    <WorkspacePageWrapper routeTab="skills" routeSelectedSkillId={selectedSkillId}>
      <SkillDetailPanel
        selectedSkillId={selectedSkillId}
        onSelectSkill={handleSelectSkill}
        docListVisible={docListVisible}
        onToggleDocList={() => setDocListVisible(v => !v)}
      />
    </WorkspacePageWrapper>
  );
}
