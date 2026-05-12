import type { QueryClient } from '@tanstack/react-query';
import type { useRouter } from 'next/navigation';
import * as gw from '@/lib/api/gateway';

type Router = ReturnType<typeof useRouter>;

interface HandleOptions {
  notif: gw.Notification;
  router: Router;
  queryClient: QueryClient;
  isMobile: boolean;
  onClose?: () => void;
}

export async function handleNotificationClick({ notif, router, queryClient, isMobile, onClose }: HandleOptions) {
  if (!notif.read) {
    try {
      await gw.markNotificationRead(notif.id);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    } catch {}
  }

  if (notif.type === 'agent_registered') {
    if (window.location.pathname === '/content') {
      window.dispatchEvent(new CustomEvent('open-agents-manager'));
    } else {
      router.push('/content?agents=1');
    }
    onClose?.();
    return;
  }

  if (!notif.link) {
    onClose?.();
    return;
  }

  const linkUrl = new URL(notif.link, window.location.origin);
  const targetId = linkUrl.searchParams.get('id');
  const commentId = linkUrl.searchParams.get('comment_id');

  if (linkUrl.pathname === '/content' && window.location.pathname === '/content' && targetId) {
    window.dispatchEvent(new CustomEvent('notification-navigate', {
      detail: { targetId, commentId },
    }));
  } else {
    router.push(notif.link);
  }
  onClose?.();
}
