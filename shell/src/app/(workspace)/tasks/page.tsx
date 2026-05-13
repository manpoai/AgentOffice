'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useEffect } from 'react';
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

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.taskId) {
        router.push(`/tasks?id=${detail.taskId}`);
      }
    };
    window.addEventListener('notification-navigate-task', handler);
    return () => window.removeEventListener('notification-navigate-task', handler);
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
