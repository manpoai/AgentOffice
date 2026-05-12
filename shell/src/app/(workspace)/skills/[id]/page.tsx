'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { WorkspacePageWrapper } from '@/components/WorkspacePageWrapper';
import { SkillDetailPanel } from '@/components/SkillDetailPanel';

export default function SkillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const skillId = params.id as string;
  const [docListVisible, setDocListVisible] = useState(true);

  const handleSelectSkill = useCallback((id: string | null) => {
    if (id) {
      router.push(`/skills/${id}`);
    } else {
      router.push('/skills');
    }
  }, [router]);

  return (
    <WorkspacePageWrapper routeTab="skills" routeSelectedSkillId={skillId}>
      <SkillDetailPanel
        selectedSkillId={skillId}
        onSelectSkill={handleSelectSkill}
        docListVisible={docListVisible}
        onToggleDocList={() => setDocListVisible(v => !v)}
      />
    </WorkspacePageWrapper>
  );
}
