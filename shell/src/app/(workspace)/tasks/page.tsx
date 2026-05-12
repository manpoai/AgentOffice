'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { WorkspacePageWrapper } from '@/components/WorkspacePageWrapper';
import { TasksMainPanel } from '@/components/TasksMainPanel';

export default function TasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTaskId = searchParams.get('id');
  const [docListVisible, setDocListVisible] = useState(true);

  const handleSelectTask = useCallback((id: string | null) => {
    router.push(id ? `/tasks?id=${id}` : '/tasks');
  }, [router]);

  return (
    <WorkspacePageWrapper routeTab="tasks" routeSelectedTaskId={selectedTaskId}>
      <TasksMainPanel
        selectedTaskId={selectedTaskId}
        onSelectTask={handleSelectTask}
        docListVisible={docListVisible}
        onToggleDocList={() => setDocListVisible(v => !v)}
      />
    </WorkspacePageWrapper>
  );
}
