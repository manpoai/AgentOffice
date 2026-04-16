'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { resolveAvatarUrl, listAgents, type Agent } from '@/lib/api/gateway';

/**
 * Tiny inline avatar (18px) for actor names in meta text.
 * Fetches agents via useQuery (shared cache, long stale time) and checks the current human user.
 */
export function ActorInlineAvatar({ name, size = 18 }: { name: string; size?: number }) {
  const { actor } = useAuth();
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: listAgents,
    staleTime: 120_000,
  });
  const agent = agents.find(a => a.name === name || a.display_name === name);

  const style = { width: size, height: size, minWidth: size };
  const imgClass = "rounded-full object-cover inline-block align-middle";

  // Check if it's the current human user
  if (actor && (actor.display_name === name || actor.username === name)) {
    const src = actor.avatar_url ? resolveAvatarUrl(actor.avatar_url) : null;
    return <img src={src || '/icons/avatar-default.jpg'} alt="" className={imgClass} style={style} />;
  }

  if (agent) {
    const src = agent.avatar_url
      ? resolveAvatarUrl(agent.avatar_url)
      : agent.platform
        ? `/icons/platform-${agent.platform}.png`
        : null;
    if (src) {
      return <img src={src} alt="" className={imgClass} style={style} />;
    }
  }

  // Fallback: default avatar
  return <img src="/icons/avatar-default.jpg" alt="" className={imgClass} style={style} />;
}
