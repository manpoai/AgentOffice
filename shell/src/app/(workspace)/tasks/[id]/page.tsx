'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { WorkspacePageWrapper } from '@/components/WorkspacePageWrapper';
import { TasksMainPanel } from '@/components/TasksMainPanel';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;
  const [docListVisible, setDocListVisible] = useState(true);

  const handleSelectTask = useCallback((id: string | null) => {
    if (id) {
      router.push(`/tasks/${id}`);
    } else {
      router.push('/tasks');
    }
  }, [router]);

  return (
    <WorkspacePageWrapper routeTab="tasks" routeSelectedTaskId={taskId}>
      <TasksMainPanel
        selectedTaskId={taskId}
        onSelectTask={handleSelectTask}
        docListVisible={docListVisible}
        onToggleDocList={() => setDocListVisible(v => !v)}
      />
    </WorkspacePageWrapper>
  );
}
