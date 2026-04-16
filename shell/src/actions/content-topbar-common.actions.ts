import { Clock, AtSign, Search } from 'lucide-react';
import type { ActionDef } from './types';
import type { ContentItemCtx } from './content-item.actions';
import { buildActionMap } from './types';
import { contentItemActions } from './content-item.actions';
import { toContentMenuItems } from '@/surfaces/bridge';
import { contentTopBarSurfaces } from '@/surfaces/content-topbar.surfaces';

export interface ContentTopBarCommonCtx extends ContentItemCtx {
  showHistory: () => void;
  showComments: () => void;
  search?: () => void;
}

export const contentTopBarCommonActions: ActionDef<ContentTopBarCommonCtx>[] = [
  {
    id: 'history',
    label: t => t('content.versionHistory'),
    icon: Clock,
    shortcut: '⌘⇧H',
    group: 'history',
    execute: ctx => ctx.showHistory(),
  },
  {
    id: 'comments',
    label: t => t('content.comments'),
    icon: AtSign,
    shortcut: '⌘J',
    group: 'collab',
    execute: ctx => ctx.showComments(),
  },
  {
    id: 'search',
    label: t => t('common.search'),
    icon: Search,
    shortcut: '⌘F',
    group: 'content',
    execute: ctx => ctx.search?.(),
  },
];

const contentItemActionMap = buildActionMap(contentItemActions as ActionDef<ContentTopBarCommonCtx>[]);
const topBarCommonActionMap = buildActionMap(contentTopBarCommonActions);
const contentTopBarActionMap = {
  ...contentItemActionMap,
  ...topBarCommonActionMap,
};

export function buildContentTopBarCommonMenuItems(t: (key: string, params?: Record<string, string | number>) => string, ctx: ContentTopBarCommonCtx) {
  const items = toContentMenuItems(contentTopBarSurfaces.moreMenu, contentTopBarActionMap, ctx, t);
  return items.filter(item => item.id !== 'search' || ctx.search);
}
