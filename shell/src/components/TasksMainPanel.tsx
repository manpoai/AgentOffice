'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import * as gw from '@/lib/api/gateway';
import { resolveAvatarUrl, getSyncStatus } from '@/lib/api/gateway';
import type { Task, TaskAttachment, TaskActivity } from '@/lib/api/gateway';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, ChevronLeft, X, RefreshCw, Trash2, MoreHorizontal, Circle, CheckCircle2, Loader2, ChevronDown, Search, Paperclip, Clock, User, Calendar, BarChart3 } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils/time';
import dynamic from 'next/dynamic';
import { EditorSkeleton } from '@/components/shared/Skeleton';
import { CommentPanel } from '@/components/shared/CommentPanel';

const Editor = dynamic(
  () => import('@/components/editor/Editor').then(m => ({ default: m.Editor })),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

const COLUMNS = [
  { key: 'todo', label: 'To Do', color: 'bg-gray-400' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { key: 'done', label: 'Done', color: 'bg-sidebar-primary' },
] as const;

interface TasksMainPanelProps {
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  docListVisible: boolean;
  onToggleDocList: () => void;
}

function useFilteredAgents() {
  const { data: allAgents } = useQuery({
    queryKey: ['admin-agents'],
    queryFn: gw.listAllAgents,
  });
  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: getSyncStatus,
    staleTime: 60_000,
  });
  const myDeviceId = syncStatus?.device_id || null;
  const agents = (allAgents || []).filter(a => {
    if (a.agent_kind === 'connector') return false;
    if (a.agent_kind !== 'local') return true;
    return !!myDeviceId && a.origin_device_id === myDeviceId;
  });
  return { agents, allAgents: allAgents || [] };
}

export function TasksMainPanel({ selectedTaskId, onSelectTask, docListVisible, onToggleDocList }: TasksMainPanelProps) {
  const [createMode, setCreateMode] = useState(false);

  return (
    <div className="flex-1 flex min-h-0 relative">
      <TaskKanbanView
        onSelectTask={onSelectTask}
        onCreateTask={() => setCreateMode(true)}
        docListVisible={docListVisible}
        onToggleDocList={onToggleDocList}
      />

      {selectedTaskId && !createMode && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/20 dark:bg-black/40" onClick={() => onSelectTask(null)} />
          <div className="relative w-full max-w-[520px] h-full animate-in slide-in-from-right duration-200">
            <TaskDrawer mode="edit" taskId={selectedTaskId} onClose={() => onSelectTask(null)} />
          </div>
        </div>
      )}

      {createMode && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/20 dark:bg-black/40" onClick={() => setCreateMode(false)} />
          <div className="relative w-full max-w-[520px] h-full animate-in slide-in-from-right duration-200">
            <TaskDrawer mode="create" onClose={() => setCreateMode(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Kanban View ──────────────────────────────────────────────────────────────

function TaskKanbanView({ onSelectTask, onCreateTask, docListVisible, onToggleDocList }: {
  onSelectTask: (id: string) => void;
  onCreateTask: () => void;
  docListVisible: boolean;
  onToggleDocList: () => void;
}) {
  const [agentFilter, setAgentFilter] = useState('');
  const { agents, allAgents } = useFilteredAgents();

  const { data } = useQuery({
    queryKey: ['tasks', agentFilter],
    queryFn: () => gw.listTasks({
      assignee_id: agentFilter || undefined,
      limit: 200,
    }),
  });

  const { data: schedulesData } = useQuery({
    queryKey: ['schedules'],
    queryFn: gw.listSchedules,
  });

  const tasks = data?.tasks || [];
  const schedulesMap = new Map((schedulesData?.schedules || []).map(s => [s.id, s]));

  const getAgentInfo = (agentId: string | null) => {
    if (!agentId || !allAgents) return null;
    return allAgents.find(a => a.agent_id === agentId);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-900 md:rounded-lg md:overflow-hidden">
      <div className="flex items-center h-12 px-4 border-b border-border/50 shrink-0 gap-3 bg-white dark:bg-gray-800">
        {!docListVisible && (
          <button onClick={onToggleDocList} className="mr-2 p-1 rounded hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <h2 className="text-sm font-semibold">Tasks</h2>
        <select
          value={agentFilter}
          onChange={e => setAgentFilter(e.target.value)}
          className="ml-auto h-7 px-2 rounded-md text-xs bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.06] text-foreground/70 outline-none"
        >
          <option value="">All Agents</option>
          {agents.map(a => (
            <option key={a.name} value={a.agent_id}>{a.display_name || a.name}</option>
          ))}
        </select>
        <button
          onClick={onCreateTask}
          className="h-7 px-3 rounded-md text-xs font-medium bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground transition-colors flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          New Task
        </button>
      </div>

      <div className="flex-1 flex gap-4 p-4 min-h-0 overflow-x-auto">
        {COLUMNS.map(col => {
          const columnTasks = tasks.filter(t => t.status === col.key);
          return (
            <div key={col.key} className="flex flex-col min-w-[260px] w-[300px] shrink-0">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={cn('w-2.5 h-2.5 rounded-full', col.color)} />
                <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">{col.label}</span>
                <span className="text-xs text-foreground/40">{columnTasks.length}</span>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2 pr-1">
                  {columnTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      agent={getAgentInfo(task.assignee_id)}
                      scheduleType={task.schedule_id ? schedulesMap.get(task.schedule_id)?.schedule_type : undefined}
                      onClick={() => onSelectTask(task.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Task Card ────────────────────────────────────────────────────────────────

function formatDueAt(ts: number): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hour}:${min}`;
}

function TaskCard({ task, agent, scheduleType, onClick }: { task: Task; agent: gw.Agent | null | undefined; scheduleType?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg bg-white dark:bg-gray-800 border border-black/[0.06] dark:border-white/[0.06] hover:shadow-sm transition-all"
    >
      <div className="text-sm font-medium truncate">{task.title}</div>
      <div className="flex items-center gap-2 mt-2">
        {task.due_at && (
          <span className="text-[10px] text-foreground/50">
            {formatDueAt(task.due_at)}
          </span>
        )}
        {task.schedule_id && scheduleType !== 'once' && (
          <span className="flex items-center text-[10px] text-sidebar-primary" title="Recurring">
            <RefreshCw className="h-3 w-3" />
          </span>
        )}
        <div className="flex-1" />
        {agent && (
          <AgentAvatar agent={agent} size={20} />
        )}
      </div>
    </button>
  );
}

// ── Status Icons ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  todo: { icon: <Circle className="h-4 w-4" />, label: 'To Do', color: 'text-gray-400' },
  in_progress: { icon: <Loader2 className="h-4 w-4" />, label: 'In Progress', color: 'text-blue-500' },
  done: { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Done', color: 'text-green-500' },
};

// ── Popover wrapper ─────────────────────────────────────────────────────────

function Popover({ trigger, children, open, onOpenChange }: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => onOpenChange(!open)}>{trigger}</div>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Property Row ────────────────────────────────────────────────────────────

function PropertyRow({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 min-h-[30px]">
      <div className="w-[120px] flex items-center gap-2 shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ── Status Picker ───────────────────────────────────────────────────────────

function StatusPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[value] || STATUS_CONFIG.todo;

  return (
    <Popover open={open} onOpenChange={setOpen} trigger={
      <button className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium hover:bg-accent transition-colors', cfg.color)}>
        {cfg.icon}
        <span>{cfg.label}</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>
    }>
      {Object.entries(STATUS_CONFIG).map(([key, c]) => (
        <button
          key={key}
          onClick={() => { onChange(key); setOpen(false); }}
          className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors', c.color)}
        >
          {c.icon}
          <span className="text-foreground">{c.label}</span>
          {key === value && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-sidebar-primary" />}
        </button>
      ))}
    </Popover>
  );
}

// ── Assignee Picker ─────────────────────────────────────────────────────────

function AgentAvatar({ agent, size = 20 }: { agent: gw.Agent | null | undefined; size?: number }) {
  if (!agent) return null;
  const avatarUrl = resolveAvatarUrl(agent.avatar_url);
  const platformFallback = !avatarUrl && agent.platform ? `/icons/platform-${agent.platform}.png` : null;
  return (
    <div
      className="rounded-full bg-muted overflow-hidden shrink-0 border border-black/10 dark:border-white/10"
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : platformFallback ? (
        <img src={platformFallback} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[9px] font-medium text-muted-foreground">
          {(agent.display_name || agent.name || '?')[0].toUpperCase()}
        </div>
      )}
    </div>
  );
}

function AssigneePicker({ value, agents, onChange }: {
  value: string | null;
  agents: gw.Agent[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const agent = agents.find(a => a.agent_id === value);
  const filtered = search.trim()
    ? agents.filter(a => (a.display_name || a.name).toLowerCase().includes(search.toLowerCase()))
    : agents;

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (!v) setSearch(''); }} trigger={
      <button className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-accent transition-colors">
        {agent ? (
          <>
            <AgentAvatar agent={agent} size={18} />
            <span className="font-medium">{agent.display_name || agent.name}</span>
          </>
        ) : (
          <>
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Unassigned</span>
          </>
        )}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>
    }>
      <div className="px-2 py-1.5 border-b border-border/50">
        <div className="flex items-center gap-1.5 px-2 h-7 rounded-md bg-muted/50">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50"
            autoFocus
          />
        </div>
      </div>
      <button
        onClick={() => { onChange(''); setOpen(false); }}
        className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors', !value && 'bg-accent/50')}
      >
        <User className="h-4 w-4 text-muted-foreground" />
        <span>Unassigned</span>
      </button>
      {filtered.map(a => (
        <button
          key={a.agent_id}
          onClick={() => { onChange(a.agent_id); setOpen(false); }}
          className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors', a.agent_id === value && 'bg-accent/50')}
        >
          <AgentAvatar agent={a} size={20} />
          <span>{a.display_name || a.name}</span>
          {a.agent_id === value && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-sidebar-primary" />}
        </button>
      ))}
    </Popover>
  );
}

// ── Schedule Picker (Popover) ───────────────────────────────────────────────

type ScheduleType = 'none' | 'once' | 'daily' | 'weekly';

interface ScheduleConfig {
  type: ScheduleType;
  date?: string;
  time?: string;
  times?: string[];
  days?: number[];
}

function computeNextDueAt(config: ScheduleConfig): number {
  const now = new Date();
  if (config.type === 'once' && config.date) {
    const [h, m] = (config.time || '09:00').split(':').map(Number);
    const d = new Date(config.date);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  }
  if (config.type === 'daily') {
    const times = config.times?.length
      ? config.times.map(t => t.split(':').map(Number))
      : [(config.time || '09:00').split(':').map(Number)];
    let nearest = Infinity;
    for (const [h, m] of times) {
      const candidate = new Date(now);
      candidate.setHours(h, m, 0, 0);
      if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1);
      if (candidate.getTime() < nearest) nearest = candidate.getTime();
    }
    return nearest;
  }
  if (config.type === 'weekly') {
    const [h, m] = (config.time || '09:00').split(':').map(Number);
    const days = config.days || [1];
    let nearest = Infinity;
    for (const dow of days) {
      const candidate = new Date(now);
      const diff = (dow - candidate.getDay() + 7) % 7 || 7;
      candidate.setDate(candidate.getDate() + diff);
      candidate.setHours(h, m, 0, 0);
      if (candidate.getTime() < nearest) nearest = candidate.getTime();
    }
    return nearest;
  }
  return now.getTime();
}

function scheduleToCron(config: ScheduleConfig): string | null {
  if (config.type === 'none') return null;
  if (config.type === 'daily' && config.times?.length) {
    const minutes = [...new Set(config.times.map(t => t.split(':')[1]))];
    const hours = [...new Set(config.times.map(t => t.split(':')[0]))];
    return `${minutes.join(',')} ${hours.join(',')} * * *`;
  }
  const [h, m] = (config.time || '09:00').split(':').map(Number);
  if (config.type === 'once') {
    if (!config.date) return null;
    const d = new Date(config.date);
    return `${m} ${h} ${d.getDate()} ${d.getMonth() + 1} *`;
  }
  if (config.type === 'daily') return `${m} ${h} * * *`;
  if (config.type === 'weekly') {
    const days = (config.days || [0]).join(',');
    return `${m} ${h} * * ${days}`;
  }
  return null;
}

function cronToScheduleConfig(cron: string, scheduleType?: string): ScheduleConfig {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return { type: 'none' };
  const [min, hour, dom, month, dow] = parts;
  const type = (scheduleType || 'daily') as ScheduleType;

  if (type === 'once') {
    let date: string | undefined;
    if (dom !== '*' && month !== '*') {
      const year = new Date().getFullYear();
      const d = new Date(year, parseInt(month) - 1, parseInt(dom));
      date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return { type: 'once', date, time: `${hour.padStart(2, '0')}:${min.padStart(2, '0')}` };
  }

  if (type === 'weekly' || dow !== '*') {
    const time = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
    return { type: 'weekly', days: dow !== '*' ? dow.split(',').map(Number) : [1], time };
  }

  const hours = hour.split(',');
  const mins = min.split(',');
  if (hours.length > 1 || mins.length > 1) {
    const times: string[] = [];
    for (const hh of hours) {
      for (const mm of mins) {
        times.push(`${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`);
      }
    }
    return { type: 'daily', times };
  }
  return { type: 'daily', time: `${hour.padStart(2, '0')}:${min.padStart(2, '0')}` };
}

function scheduleLabel(cron: string, scheduleType?: string): string {
  const config = cronToScheduleConfig(cron, scheduleType);
  if (config.type === 'once') return `Once ${config.date || ''} ${config.time || ''}`.trim();
  if (config.type === 'daily') {
    if (config.times?.length) return `Daily ${config.times.join(', ')}`;
    return `Daily ${config.time || '09:00'}`;
  }
  if (config.type === 'weekly') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = (config.days || []).map(d => dayNames[d]).join(', ');
    return `Weekly ${days} ${config.time || '09:00'}`;
  }
  return 'Scheduled';
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SCHEDULE_TYPES: { key: ScheduleType; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'once', label: 'Once' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
];

function SchedulePicker({ value, onChange }: { value: ScheduleConfig; onChange: (v: ScheduleConfig) => void }) {
  const [open, setOpen] = useState(false);
  const label = value.type === 'none' ? 'None' : scheduleLabel(
    scheduleToCron(value) || '', value.type
  );

  return (
    <Popover open={open} onOpenChange={setOpen} trigger={
      <button className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-accent transition-colors">
        {value.type !== 'none' ? (
          <RefreshCw className="h-3.5 w-3.5 text-sidebar-primary" />
        ) : (
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className={value.type !== 'none' ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>
    }>
      <div className="p-3 space-y-3 min-w-[260px]">
        <div className="flex gap-1">
          {SCHEDULE_TYPES.map(st => (
            <button
              key={st.key}
              onClick={() => onChange({ ...value, type: st.key })}
              className={cn(
                'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                value.type === st.key
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              {st.label}
            </button>
          ))}
        </div>

        {value.type === 'once' && (
          <div className="flex gap-2">
            <input
              type="date"
              value={value.date || ''}
              onChange={e => onChange({ ...value, date: e.target.value })}
              className="flex-1 h-8 px-2 rounded-md text-xs bg-muted/50 border border-border/50 outline-none"
            />
            <input
              type="time"
              value={value.time || '09:00'}
              onChange={e => onChange({ ...value, time: e.target.value })}
              className="h-8 px-2 rounded-md text-xs bg-muted/50 border border-border/50 outline-none"
            />
          </div>
        )}

        {value.type === 'daily' && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              {(value.times || [value.time || '09:00']).map((t, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="time"
                    value={t}
                    onChange={e => {
                      const times = [...(value.times || [value.time || '09:00'])];
                      times[i] = e.target.value;
                      onChange({ ...value, times, time: times[0] });
                    }}
                    className="h-8 px-2 rounded-md text-xs bg-muted/50 border border-border/50 outline-none"
                  />
                  {(value.times || []).length > 1 && (
                    <button
                      onClick={() => {
                        const times = (value.times || []).filter((_, j) => j !== i);
                        onChange({ ...value, times, time: times[0] });
                      }}
                      className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => {
                  const times = [...(value.times || [value.time || '09:00']), '12:00'];
                  onChange({ ...value, times, time: times[0] });
                }}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-sidebar-primary hover:bg-sidebar-primary/10 rounded transition-colors"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
          </div>
        )}

        {value.type === 'weekly' && (
          <div className="space-y-2">
            <div className="flex gap-1">
              {DAY_LABELS.map((d, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const days = value.days || [];
                    onChange({ ...value, days: days.includes(i) ? days.filter(x => x !== i) : [...days, i] });
                  }}
                  className={cn(
                    'w-8 h-8 rounded-md text-[10px] font-medium transition-colors',
                    (value.days || []).includes(i)
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
            <input
              type="time"
              value={value.time || '09:00'}
              onChange={e => onChange({ ...value, time: e.target.value })}
              className="h-8 px-2 rounded-md text-xs bg-muted/50 border border-border/50 outline-none"
            />
          </div>
        )}
      </div>
    </Popover>
  );
}

// ── Attachment Picker (Popover) ─────────────────────────────────────────────

const ATT_TYPE_LABELS: Record<string, string> = { skill: 'Skills', memory: 'Memory', content: 'Content' };
const ATT_TYPE_COLORS: Record<string, string> = {
  skill: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  memory: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  content: 'bg-sidebar-primary/10 text-sidebar-primary',
};

interface PendingAttachment { type: string; id: string; title: string; }

function AttachmentSection({
  taskId, attachments, pendingAttachments, onRemove, onAddPending, onRemovePending,
}: {
  taskId?: string;
  attachments?: TaskAttachment[];
  pendingAttachments?: PendingAttachment[];
  onRemove?: (attId: string) => void;
  onAddPending?: (att: PendingAttachment) => void;
  onRemovePending?: (idx: number) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'skill' | 'memory' | 'content'>('skill');
  const [search, setSearch] = useState('');

  const { data: skills } = useQuery({
    queryKey: ['skills'],
    queryFn: () => gw.listSkills({ limit: 200 }),
    enabled: open && pickerTab === 'skill',
  });
  const { data: memories } = useQuery({
    queryKey: ['memories-all'],
    queryFn: () => gw.listMemories({ limit: 200 }),
    enabled: open && pickerTab === 'memory',
  });
  const { data: contentItems } = useQuery({
    queryKey: ['content-items'],
    queryFn: gw.listContentItems,
    enabled: open && pickerTab === 'content',
  });

  const attachedIds = new Set([
    ...(attachments || []).map(a => a.attachment_id),
    ...(pendingAttachments || []).map(a => a.id),
  ]);

  const handleAttach = async (type: string, id: string, title: string) => {
    if (taskId && onRemove) {
      await gw.addTaskAttachment(taskId, { attachment_type: type, attachment_id: id });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    } else if (onAddPending) {
      onAddPending({ type, id, title });
    }
  };

  const filterItems = <T extends { title: string }>(items: T[]) => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i => i.title.toLowerCase().includes(q));
  };

  const allAttachments = [
    ...(attachments || []).map(a => ({ id: a.id, attId: a.attachment_id, type: a.attachment_type, title: a.attachment_id, isPending: false })),
    ...(pendingAttachments || []).map((a, i) => ({ id: `pending-${i}`, attId: a.id, type: a.type, title: a.title, isPending: true, idx: i })),
  ];

  return (
    <div className="flex items-start gap-2 min-h-[30px]">
      <div className="w-[120px] flex items-center gap-2 shrink-0 pt-1">
        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Attachments</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-1.5 items-center">
          {allAttachments.map(att => (
            <div key={att.id} className="group flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 border border-border/50 text-xs">
              <span className={cn('text-[9px] font-medium px-1 py-px rounded', ATT_TYPE_COLORS[att.type] || '')}>
                {ATT_TYPE_LABELS[att.type] || att.type}
              </span>
              <span className="text-foreground/70 truncate max-w-[120px]">{att.title}</span>
              <button
                onClick={() => {
                  if (att.isPending && onRemovePending) onRemovePending((att as any).idx);
                  else if (onRemove) onRemove(att.id);
                }}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:text-red-500 text-muted-foreground transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          <Popover open={open} onOpenChange={v => { setOpen(v); if (!v) setSearch(''); }} trigger={
            <button className="flex items-center gap-1 px-2 py-1 text-[11px] text-sidebar-primary hover:bg-sidebar-primary/10 rounded transition-colors">
              <Plus className="h-3 w-3" /> Add
            </button>
          }>
            <div className="min-w-[240px]">
              <div className="flex border-b border-border/30">
                {(['skill', 'memory', 'content'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setPickerTab(tab); setSearch(''); }}
                    className={cn(
                      'flex-1 px-3 py-2 text-xs font-medium transition-colors',
                      pickerTab === tab
                        ? 'text-sidebar-primary border-b-2 border-sidebar-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {ATT_TYPE_LABELS[tab]}
                  </button>
                ))}
              </div>

              <div className="px-2 py-1.5 border-b border-border/30">
                <div className="flex items-center gap-1.5 px-2 h-7 rounded-md bg-muted/50">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50"
                    autoFocus
                  />
                </div>
              </div>

              <div className="max-h-[200px] overflow-y-auto py-1">
                {pickerTab === 'skill' && filterItems(skills?.skills || []).map(s => (
                  <PickerItem key={s.id} title={s.title} attached={attachedIds.has(s.id)} onAttach={() => handleAttach('skill', s.id, s.title)} />
                ))}
                {pickerTab === 'memory' && filterItems(memories?.memories || []).map(m => (
                  <PickerItem key={m.id} title={m.title} attached={attachedIds.has(m.id)} onAttach={() => handleAttach('memory', m.id, m.title)} />
                ))}
                {pickerTab === 'content' && filterItems(contentItems || []).map(c => (
                  <PickerItem key={c.id} title={c.title} attached={attachedIds.has(c.id)} onAttach={() => handleAttach('content', c.id, c.title)} />
                ))}
              </div>
            </div>
          </Popover>
        </div>
      </div>
    </div>
  );
}

function PickerItem({ title, attached, onAttach }: { title: string; attached: boolean; onAttach: () => void }) {
  return (
    <button
      onClick={attached ? undefined : onAttach}
      disabled={attached}
      className={cn(
        'w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs transition-colors',
        attached ? 'opacity-50 cursor-default' : 'hover:bg-accent'
      )}
    >
      <span className="flex-1 truncate">{title}</span>
      {attached ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-sidebar-primary shrink-0" />
      ) : (
        <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
    </button>
  );
}

// ── Activity Timeline ───────────────────────────────────────────────────────

function ActivityTimeline({ taskId, agents }: { taskId: string; agents: gw.Agent[] }) {
  const { data } = useQuery({
    queryKey: ['task-activity', taskId],
    queryFn: () => gw.getTaskActivity(taskId),
    staleTime: 10_000,
  });

  const activity = data?.activity || [];
  if (activity.length === 0) return <div className="text-xs text-muted-foreground py-2">No activity yet</div>;

  const getAgentName = (id: string | null) => {
    if (!id) return 'System';
    const agent = agents.find(a => a.agent_id === id);
    return agent?.display_name || agent?.name || id;
  };

  const statusLabel = (s: string) => STATUS_CONFIG[s]?.label || s;
  const statusIcon = (s: string) => STATUS_CONFIG[s]?.icon || <Circle className="h-3.5 w-3.5" />;
  const statusColor = (s: string) => STATUS_CONFIG[s]?.color || 'text-gray-400';

  return (
    <div className="relative">
      {activity.map((item, i) => (
        <div key={i} className="flex items-start gap-2.5 py-1.5">
          <div className={cn(
            'shrink-0 w-5 h-5 rounded-md border border-border bg-card flex items-center justify-center mt-px',
            item.type === 'status_change' ? statusColor(item.detail.to as string) : 'text-muted-foreground'
          )}>
            {item.type === 'created' && <Plus className="h-3 w-3" />}
            {item.type === 'status_change' && statusIcon(item.detail.to as string)}
            {item.type === 'assignee_change' && <User className="h-3 w-3" />}
            {item.type === 'priority_change' && <BarChart3 className="h-3 w-3" />}
          </div>
          <div className="flex-1 min-w-0 text-xs text-muted-foreground leading-5">
            <span className="font-medium text-foreground">{item.actor}</span>
            {' '}
            {item.type === 'created' && 'created the task'}
            {item.type === 'status_change' && (
              <>set status to <span className={cn('font-medium', statusColor(item.detail.to as string))}>{statusLabel(item.detail.to as string)}</span></>
            )}
            {item.type === 'assignee_change' && (
              <>
                {item.detail.to
                  ? <>assigned to <span className="font-medium text-foreground">{getAgentName(item.detail.to as string)}</span></>
                  : 'removed assignee'
                }
              </>
            )}
            {item.type === 'priority_change' && (
              <>set priority to <span className="font-medium text-foreground">{item.detail.to as string}</span></>
            )}
            <span className="ml-2 text-muted-foreground/60">{formatRelativeTime(item.timestamp)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Task Drawer (Create + Edit) ──────────────────────────────────────────────

function TaskDrawer({ mode, taskId, onClose }: {
  mode: 'create' | 'edit';
  taskId?: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [titleValue, setTitleValue] = useState<string | null>(null);
  const { agents } = useFilteredAgents();
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');

  const { data: task } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => gw.getTask(taskId!),
    enabled: mode === 'edit' && !!taskId,
  });

  const { data: editSchedule } = useQuery({
    queryKey: ['schedule', task?.schedule_id],
    queryFn: () => gw.getSchedule(task!.schedule_id!),
    enabled: mode === 'edit' && !!task?.schedule_id,
  });

  const [createTitle, setCreateTitle] = useState('');
  const [createAssignee, setCreateAssignee] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createSchedule, setCreateSchedule] = useState<ScheduleConfig>({ type: 'none' });
  const [editScheduleConfig, setEditScheduleConfig] = useState<ScheduleConfig | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleTitleBlur = useCallback(async () => {
    if (!task || titleValue === null || titleValue === task.title) return;
    if (!titleValue.trim()) { setTitleValue(task.title); return; }
    await gw.updateTask(taskId!, { title: titleValue.trim() });
    queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [task, titleValue, taskId, queryClient]);

  const handleContentChange = useCallback(async (markdown: string) => {
    if (mode === 'create') { setCreateDescription(markdown); return; }
    setSaving(true);
    try { await gw.updateTask(taskId!, { text: markdown }); }
    finally { setSaving(false); }
  }, [taskId, mode]);

  const handleStatusChange = async (status: string) => {
    await gw.updateTask(taskId!, { status } as any);
    queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['task-activity', taskId] });
  };

  const handleAssigneeChange = async (newAssigneeId: string) => {
    await gw.updateTask(taskId!, { assignee_id: newAssigneeId || null } as any);
    queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['task-activity', taskId] });
  };

  const handleRemoveAttachment = async (attId: string) => {
    await gw.removeTaskAttachment(taskId!, attId);
    queryClient.invalidateQueries({ queryKey: ['task', taskId] });
  };

  const handleDeleteConfirm = async (deleteSchedule: boolean) => {
    setShowDeleteConfirm(false);
    await gw.deleteTask(taskId!, deleteSchedule ? { deleteSchedule: true } : undefined);
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
    onClose();
  };

  const handleScheduleUpdate = async (config: ScheduleConfig) => {
    setEditScheduleConfig(config);
    if (!task?.schedule_id) {
      if (config.type === 'none') return;
      const cron = scheduleToCron(config);
      if (!cron) return;
      const result = await gw.createSchedule({
        title: task?.title || '',
        cron,
        schedule_type: config.type,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        template_json: {
          title: task?.title,
          assignee_id: task?.assignee_id,
          attachments: task?.attachments?.length
            ? task.attachments.map((a: any) => ({ type: a.attachment_type, id: a.attachment_id }))
            : undefined,
        },
      });
      await gw.updateTask(taskId!, { schedule_id: result.schedule_id } as any);
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    } else {
      if (config.type === 'none') {
        await gw.deleteSchedule(task.schedule_id);
        await gw.updateTask(taskId!, { schedule_id: null } as any);
        queryClient.invalidateQueries({ queryKey: ['task', taskId] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['schedules'] });
      } else {
        const cron = scheduleToCron(config);
        if (!cron) return;
        await gw.updateSchedule(task.schedule_id, { cron, schedule_type: config.type });
        queryClient.invalidateQueries({ queryKey: ['schedule', task.schedule_id] });
        queryClient.invalidateQueries({ queryKey: ['schedules'] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
    }
  };

  const handleCreate = async () => {
    if (!createTitle.trim() || submitting) return;
    setSubmitting(true);
    try {
      const hasSchedule = createSchedule.type !== 'none';
      const dueAt = hasSchedule ? computeNextDueAt(createSchedule) : undefined;

      const result = await gw.createTask({
        title: createTitle.trim(),
        text: createDescription || undefined,
        assignee_id: createAssignee || undefined,
        due_at: dueAt,
      } as any);

      const newTaskId = result.task_id;
      if (!newTaskId) { console.error('createTask did not return task_id:', result); return; }

      for (const att of pendingAttachments) {
        await gw.addTaskAttachment(newTaskId, { attachment_type: att.type, attachment_id: att.id });
      }

      if (hasSchedule) {
        const cron = scheduleToCron(createSchedule);
        if (cron) {
          const schedResult = await gw.createSchedule({
            title: createTitle.trim(),
            cron,
            schedule_type: createSchedule.type,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            template_json: {
              title: createTitle.trim(),
              text: createDescription || undefined,
              assignee_id: createAssignee || undefined,
              attachments: pendingAttachments.length > 0
                ? pendingAttachments.map(a => ({ type: a.type, id: a.id }))
                : undefined,
            },
          });
          if (schedResult.schedule_id) {
            await gw.updateTask(newTaskId, { schedule_id: schedResult.schedule_id } as any);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    } catch (e) {
      console.error('Failed to create task:', e);
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'edit' && !task) {
    return (
      <div className="h-full flex items-center justify-center bg-card rounded-l-lg shadow-[-4px_0_24px_rgba(0,0,0,0.12)]">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const displayTitle = mode === 'edit'
    ? (titleValue !== null ? titleValue : task?.title || '')
    : createTitle;

  return (
    <div className="h-full flex flex-col bg-card rounded-l-lg shadow-[-4px_0_24px_rgba(0,0,0,0.12)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center h-11 px-4 border-b border-border/50 shrink-0">
        <span className="text-xs font-medium text-muted-foreground flex-1">
          {mode === 'create' ? 'New Task' : 'Task Detail'}
        </span>
        {mode === 'edit' && (
          <>
            {saving && <span className="text-[10px] text-muted-foreground mr-2">Saving...</span>}
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
                    <button
                      onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-accent transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Task
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
        <button onClick={onClose} className="p-1.5 rounded hover:bg-accent text-muted-foreground ml-1">
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-3xl mx-auto w-full task-drawer-content">
          {/* Title */}
          <div className="px-6 pt-5 pb-3">
            <input
              value={displayTitle}
              onChange={e => mode === 'create' ? setCreateTitle(e.target.value) : setTitleValue(e.target.value)}
              onBlur={mode === 'edit' ? handleTitleBlur : undefined}
              className="text-lg font-semibold w-full bg-transparent outline-none placeholder:text-foreground/20"
              placeholder="Task title..."
              autoFocus={mode === 'create'}
            />
          </div>

          {/* Properties */}
          <div className="px-6 pb-3 space-y-0.5">
            {mode === 'edit' && (
              <>
                <PropertyRow icon={Circle} label="Status">
                  <StatusPicker value={task?.status || 'todo'} onChange={handleStatusChange} />
                </PropertyRow>

                <PropertyRow icon={User} label="Assignee">
                  <AssigneePicker value={task?.assignee_id || null} agents={agents} onChange={handleAssigneeChange} />
                </PropertyRow>

                <PropertyRow icon={Calendar} label="Schedule">
                  <SchedulePicker
                    value={editScheduleConfig ?? (editSchedule ? cronToScheduleConfig(editSchedule.cron, editSchedule.schedule_type) : { type: 'none' })}
                    onChange={handleScheduleUpdate}
                  />
                </PropertyRow>

                <AttachmentSection
                  taskId={taskId}
                  attachments={task?.attachments || []}
                  onRemove={handleRemoveAttachment}
                />
              </>
            )}

            {mode === 'create' && (
              <>
                <PropertyRow icon={User} label="Assignee">
                  <AssigneePicker value={createAssignee || null} agents={agents} onChange={setCreateAssignee} />
                </PropertyRow>

                <PropertyRow icon={Calendar} label="Schedule">
                  <SchedulePicker value={createSchedule} onChange={setCreateSchedule} />
                </PropertyRow>

                <AttachmentSection
                  pendingAttachments={pendingAttachments}
                  onAddPending={att => setPendingAttachments(prev => [...prev, att])}
                  onRemovePending={idx => setPendingAttachments(prev => prev.filter((_, i) => i !== idx))}
                />
              </>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border/30 mx-6" />

          {/* Editor */}
          <div className="py-4 min-h-[120px] [&_.bh-click]:!hidden [&_.bh-handle]:!translate-x-5 [&_.doc-editor-mount]:!px-6 [&_.doc-editor-mount]:!pb-0 [&_.ProseMirror]:!text-sm">
            <Editor
              key={mode === 'edit' ? taskId : 'create'}
              defaultValue={mode === 'edit' ? (task?.text || '') : ''}
              onChange={handleContentChange}
              placeholder="Write task description..."
            />
          </div>

          {/* Comments / Activity tabs (edit mode only) */}
          {mode === 'edit' && taskId && (
            <>
              <div className="border-t border-border/30 mx-6" />
              <div className="px-6">
                <div className="flex items-center gap-4 py-2">
                  <button
                    onClick={() => setActiveTab('comments')}
                    className={cn(
                      'text-xs font-medium pb-1 transition-colors border-b-2',
                      activeTab === 'comments'
                        ? 'text-foreground border-sidebar-primary'
                        : 'text-muted-foreground border-transparent hover:text-foreground'
                    )}
                  >
                    Comments
                  </button>
                  <button
                    onClick={() => setActiveTab('activity')}
                    className={cn(
                      'text-xs font-medium pb-1 transition-colors border-b-2',
                      activeTab === 'activity'
                        ? 'text-foreground border-sidebar-primary'
                        : 'text-muted-foreground border-transparent hover:text-foreground'
                    )}
                  >
                    Activity
                  </button>
                </div>

                {activeTab === 'comments' && (
                  <CommentPanel
                    targetType="task"
                    targetId={taskId}
                    className="bg-transparent border-none p-0"
                    autoFocus={false}
                  />
                )}

                {activeTab === 'activity' && (
                  <ActivityTimeline taskId={taskId} agents={agents} />
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Bottom actions */}
      {mode === 'create' && (
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/50 shrink-0">
          <button
            onClick={onClose}
            className="h-8 px-4 rounded-md text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!createTitle.trim() || submitting}
            className="h-8 px-4 rounded-md text-xs font-medium bg-sidebar-primary hover:bg-sidebar-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sidebar-primary-foreground transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowDeleteConfirm(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 bg-background rounded-xl shadow-xl w-full max-w-xs overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-sm font-semibold mb-1">Delete Task</h3>
              <p className="text-xs text-muted-foreground">
                {task?.schedule_id && editSchedule?.schedule_type !== 'once'
                  ? 'This task is part of a recurring schedule.'
                  : 'Are you sure you want to delete this task?'}
              </p>
            </div>
            <div className="px-5 pb-5 space-y-2">
              {task?.schedule_id && editSchedule?.schedule_type !== 'once' ? (
                <>
                  <button
                    onClick={() => handleDeleteConfirm(false)}
                    className="w-full h-9 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors"
                  >
                    Delete this task only
                  </button>
                  <button
                    onClick={() => handleDeleteConfirm(true)}
                    className="w-full h-9 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    Delete entire cycle
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleDeleteConfirm(!!task?.schedule_id)}
                  className="w-full h-9 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full h-9 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
