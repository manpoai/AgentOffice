'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { WorkspacePageWrapper } from '@/components/WorkspacePageWrapper';
import { TasksMainPanel } from '@/components/TasksMainPanel';

export default function TasksPage() {
  const router = useRouter();
  const [docListVisible, setDocListVisible] = useState(true);

  const handleSelectTask = useCallback((id: string | null) => {
    if (id) {
      router.push(`/tasks/${id}`);
    }
  }, [router]);

  return (
    <WorkspacePageWrapper routeTab="tasks" routeSelectedTaskId={null}>
      <TasksMainPanel
        selectedTaskId={null}
        onSelectTask={handleSelectTask}
        docListVisible={docListVisible}
        onToggleDocList={() => setDocListVisible(v => !v)}
      />
    </WorkspacePageWrapper>
  );
}
