import { create } from 'zustand';
import type { MMChannel, MMPost, MMUser, MMChannelMember } from '@/lib/api/mm';

interface IMState {
  // Current user
  myUserId: string | null;

  // Channel data
  channels: MMChannel[];
  channelMembers: Record<string, MMChannelMember>;
  activeChannelId: string | null;

  // Messages per channel
  messages: Record<string, MMPost[]>;

  // Users cache
  users: Record<string, MMUser>;

  // Agent avatar overrides (username → avatar_url from Gateway)
  agentAvatars: Record<string, string>;

  // WebSocket status
  wsStatus: 'connecting' | 'connected' | 'disconnected';

  // Mobile: show channel list or messages
  mobileView: 'channels' | 'messages';

  // Actions
  setMyUserId: (id: string) => void;
  setChannels: (channels: MMChannel[]) => void;
  setChannelMembers: (members: MMChannelMember[]) => void;
  setActiveChannel: (id: string | null) => void;
  setMessages: (channelId: string, posts: MMPost[]) => void;
  addMessage: (post: MMPost) => void;
  setUsers: (users: MMUser[]) => void;
  setAgentAvatars: (avatars: Record<string, string>) => void;
  setWsStatus: (status: IMState['wsStatus']) => void;
  setMobileView: (view: IMState['mobileView']) => void;
}

export const useIMStore = create<IMState>((set, get) => ({
  myUserId: null,
  channels: [],
  channelMembers: {},
  activeChannelId: null,
  messages: {},
  users: {},
  agentAvatars: {},
  wsStatus: 'disconnected',
  mobileView: 'channels',

  setMyUserId: (id) => set({ myUserId: id }),

  setChannels: (channels) => set({
    channels: channels.sort((a, b) => b.last_post_at - a.last_post_at),
  }),

  setChannelMembers: (members) => {
    const map: Record<string, MMChannelMember> = {};
    members.forEach(m => { map[m.channel_id] = m; });
    set({ channelMembers: map });
  },

  setActiveChannel: (id) => {
    set({ activeChannelId: id });
    try { if (id) sessionStorage.setItem('asuite-im-active-channel', id); } catch { /* ignore */ }
  },

  setMessages: (channelId, posts) => set(state => ({
    messages: { ...state.messages, [channelId]: posts },
  })),

  addMessage: (post) => set(state => {
    const channelMsgs = state.messages[post.channel_id] || [];
    // Avoid duplicates
    if (channelMsgs.some(m => m.id === post.id)) return state;
    return {
      messages: {
        ...state.messages,
        [post.channel_id]: [...channelMsgs, post],
      },
    };
  }),

  setUsers: (users) => set(state => {
    const map = { ...state.users };
    users.forEach(u => { map[u.id] = u; });
    return { users: map };
  }),

  setAgentAvatars: (avatars) => set({ agentAvatars: avatars }),
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setMobileView: (mobileView) => set({ mobileView }),
}));
