'use client';

import { useState } from 'react';
import { useIMStore } from '@/lib/stores/im';
import * as mm from '@/lib/api/mm';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useT } from '@/lib/i18n';

export function ChannelList() {
  const { channels, activeChannelId, setActiveChannel, users, channelMembers, setMobileView, myUserId, agentAvatars } = useIMStore();

  const getAvatarUrl = (userId: string): string => {
    const user = users[userId];
    if (user?.username && agentAvatars[user.username]) {
      return agentAvatars[user.username];
    }
    return mm.getProfileImageUrl(userId);
  };
  const [search, setSearch] = useState('');
  const { t } = useT();

  function getDisplayName(ch: typeof channels[0]) {
    if (ch.type === 'D' && ch.name) {
      const parts = ch.name.split('__');
      const otherUid = parts.find(id => id !== myUserId) || parts[0];
      const u = users[otherUid];
      if (u) return u.nickname || u.username || u.first_name || ch.display_name;
      return ch.display_name || otherUid.slice(0, 8);
    }
    return ch.display_name || ch.name;
  }

  function getOtherUserId(ch: typeof channels[0]): string | null {
    if (ch.type === 'D' && ch.name) {
      const parts = ch.name.split('__');
      return parts.find(id => id !== myUserId) || parts[0];
    }
    return null;
  }

  function getLastMessageTime(ch: typeof channels[0]): string {
    if (ch.last_post_at) {
      return formatTime(ch.last_post_at);
    }
    return '';
  }

  function getStatusText(ch: typeof channels[0]): string {
    if (ch.header) return ch.header;
    return '';
  }

  const handleSelect = (channelId: string) => {
    setActiveChannel(channelId);
    setMobileView('messages');
  };

  // Filter by search
  const filtered = search
    ? channels.filter(c => getDisplayName(c).toLowerCase().includes(search.toLowerCase()))
    : channels;

  // Sort by last_post_at descending (most recent first)
  const sorted = [...filtered].sort((a, b) => (b.last_post_at || 0) - (a.last_post_at || 0));

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="py-1">
          {channels.length === 0 ? (
            /* Skeleton loading */
            <div className="space-y-1 px-2 py-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 rounded bg-muted" style={{ width: `${60 + Math.random() * 60}px` }} />
                    <div className="h-3 rounded bg-muted/60" style={{ width: `${100 + Math.random() * 80}px` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            sorted.map(ch => {
              const isActive = activeChannelId === ch.id;
              const otherUid = getOtherUserId(ch);
              const statusText = getStatusText(ch);
              const time = getLastMessageTime(ch);

              return (
                <button
                  key={ch.id}
                  onClick={() => handleSelect(ch.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-2 py-2.5 text-left transition-colors rounded-lg mx-1',
                    isActive
                      ? 'bg-black/5 dark:bg-accent'
                      : 'hover:bg-black/[0.03] dark:hover:bg-accent/50'
                  )}
                  style={{ width: 'calc(100% - 8px)' }}
                >
                  {/* Avatar */}
                  {otherUid ? (
                    <img
                      src={getAvatarUrl(otherUid)}
                      alt=""
                      className="w-9 h-9 rounded-full bg-muted shrink-0 border border-black/10"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-muted shrink-0 border border-black/10 flex items-center justify-center text-muted-foreground text-xs font-medium">
                      {getDisplayName(ch).charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Name + status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground truncate">
                        {getDisplayName(ch)}
                      </span>
                      {time && (
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {time}
                        </span>
                      )}
                    </div>
                    {statusText && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {statusText}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
