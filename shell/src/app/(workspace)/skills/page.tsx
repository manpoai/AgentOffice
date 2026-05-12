'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { WorkspacePageWrapper } from '@/components/WorkspacePageWrapper';
import { SkillDetailPanel } from '@/components/SkillDetailPanel';

export default function SkillsPage() {
  const router = useRouter();
  const [docListVisible, setDocListVisible] = useState(true);

  const handleSelectSkill = useCallback((id: string | null) => {
    if (id) {
      router.push(`/skills/${id}`);
    }
  }, [router]);

  return (
    <WorkspacePageWrapper routeTab="skills" routeSelectedSkillId={null}>
      <SkillDetailPanel
        selectedSkillId={null}
        onSelectSkill={handleSelectSkill}
        docListVisible={docListVisible}
        onToggleDocList={() => setDocListVisible(v => !v)}
      />
    </WorkspacePageWrapper>
  );
}
