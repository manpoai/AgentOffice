'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import * as gw from '@/lib/api/gateway';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, Plus, Copy, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { EditorSkeleton } from '@/components/shared/Skeleton';

const Editor = dynamic(
  () => import('@/components/editor/Editor').then(m => ({ default: m.Editor })),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

interface SkillDetailPanelProps {
  selectedSkillId: string | null;
  onSelectSkill: (id: string | null) => void;
  sourceFilter?: string;
  docListVisible: boolean;
  onToggleDocList: () => void;
}

export function SkillDetailPanel({ selectedSkillId, onSelectSkill, sourceFilter, docListVisible, onToggleDocList }: SkillDetailPanelProps) {
  if (selectedSkillId) {
    return (
      <SkillEditorView
        skillId={selectedSkillId}
        onBack={() => onSelectSkill(null)}
        docListVisible={docListVisible}
        onToggleDocList={onToggleDocList}
      />
    );
  }

  return (
    <SkillGridView
      sourceFilter={sourceFilter}
      onSelectSkill={onSelectSkill}
      docListVisible={docListVisible}
      onToggleDocList={onToggleDocList}
    />
  );
}

function SkillGridView({ sourceFilter, onSelectSkill, docListVisible, onToggleDocList }: {
  sourceFilter?: string;
  onSelectSkill: (id: string) => void;
  docListVisible: boolean;
  onToggleDocList: () => void;
}) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['skills', sourceFilter || ''],
    queryFn: () => gw.listSkills({ source: sourceFilter || undefined, limit: 200 }),
  });

  const skills = data?.skills || [];

  const handleCreate = async () => {
    try {
      const res = await gw.createSkill({ title: 'Untitled Skill', text: '' });
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      onSelectSkill(res.skill_id);
    } catch {}
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-card md:rounded-lg md:shadow-[0px_0px_20px_0px_rgba(0,0,0,0.08)] md:overflow-hidden">
      <div className="flex items-center h-12 px-4 border-b border-border/50 shrink-0">
        {!docListVisible && (
          <button onClick={onToggleDocList} className="mr-2 p-1 rounded hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <h2 className="text-sm font-semibold flex-1">Skills</h2>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {/* Create card */}
            <button
              onClick={handleCreate}
              className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-border/50 hover:border-sidebar-primary/40 text-foreground/40 hover:text-sidebar-primary transition-colors min-h-[140px]"
            >
              <Plus className="h-6 w-6" />
              <span className="text-xs font-medium">New Skill</span>
            </button>

            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-border/50 p-4 min-h-[140px]">
                  <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                  <div className="space-y-1.5">
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                </div>
              ))
            ) : (
              skills.map(skill => (
                <button
                  key={skill.id}
                  onClick={() => onSelectSkill(skill.id)}
                  className="text-left p-4 rounded-lg border border-border/50 bg-background hover:border-border hover:shadow-sm transition-all min-h-[140px] flex flex-col"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <SourceBadge source={skill.source} />
                    <span className="text-sm font-medium truncate flex-1">{skill.title}</span>
                  </div>
                  <p className="text-xs text-foreground/50 line-clamp-4 leading-relaxed flex-1">
                    {skill.text || 'Empty skill'}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function SkillEditorView({ skillId, onBack, docListVisible, onToggleDocList }: {
  skillId: string;
  onBack: () => void;
  docListVisible: boolean;
  onToggleDocList: () => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [titleValue, setTitleValue] = useState<string | null>(null);

  const { data: skill } = useQuery({
    queryKey: ['skill', skillId],
    queryFn: () => gw.getSkill(skillId),
  });

  const handleTitleBlur = useCallback(async () => {
    if (!skill || titleValue === null || titleValue === skill.title) return;
    if (!titleValue.trim()) { setTitleValue(skill.title); return; }
    await gw.updateSkill(skillId, { title: titleValue.trim() });
    queryClient.invalidateQueries({ queryKey: ['skill', skillId] });
    queryClient.invalidateQueries({ queryKey: ['skills'] });
  }, [skill, titleValue, skillId, queryClient]);

  const handleContentChange = useCallback(async (markdown: string) => {
    if (!skill) return;
    setSaving(true);
    try {
      await gw.updateSkill(skillId, { text: markdown });
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    } finally {
      setSaving(false);
    }
  }, [skill, skillId, queryClient]);

  const handleDuplicate = async () => {
    if (!skill) return;
    const res = await gw.createSkill({ title: `${skill.title} (Copy)`, text: skill.text });
    queryClient.invalidateQueries({ queryKey: ['skills'] });
    onBack();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this skill?')) return;
    await gw.deleteSkill(skillId);
    queryClient.invalidateQueries({ queryKey: ['skills'] });
    onBack();
  };

  if (!skill) {
    return (
      <div className="flex-1 flex items-center justify-center bg-card md:rounded-lg md:shadow-[0px_0px_20px_0px_rgba(0,0,0,0.08)]">
        <div className="text-sm text-foreground/40">Loading...</div>
      </div>
    );
  }

  const isBuiltin = skill.source === 'builtin';
  const displayTitle = titleValue !== null ? titleValue : skill.title;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-card md:rounded-lg md:shadow-[0px_0px_20px_0px_rgba(0,0,0,0.08)] md:overflow-hidden">
      {/* Header */}
      <div className="flex items-center h-12 px-4 border-b border-border/50 shrink-0">
        {!docListVisible && (
          <button onClick={onToggleDocList} className="mr-2 p-1 rounded hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <button onClick={onBack} className="mr-2 p-1 rounded hover:bg-accent text-foreground/60 hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <SourceBadge source={skill.source} />
        <span className="text-xs text-foreground/30 mx-1.5">{saving ? 'Saving...' : ''}</span>
        <div className="flex-1" />
        {isBuiltin ? (
          <button
            onClick={handleDuplicate}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-foreground/60 hover:text-foreground rounded-md hover:bg-accent transition-colors"
            title="Copy as custom skill"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </button>
        ) : (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-foreground/50 hover:text-red-500 rounded-md hover:bg-accent transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        )}
      </div>

      {/* Title */}
      <div className="px-6 pt-6 pb-2 max-w-3xl mx-auto w-full">
        <input
          value={displayTitle}
          onChange={e => setTitleValue(e.target.value)}
          onBlur={handleTitleBlur}
          readOnly={isBuiltin}
          className={cn(
            'text-2xl font-bold w-full bg-transparent outline-none',
            isBuiltin && 'cursor-default'
          )}
          placeholder="Skill title..."
        />
      </div>

      {/* Editor — same as Doc editing experience */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 max-w-3xl mx-auto w-full">
        <Editor
          key={skillId}
          defaultValue={skill.text || ''}
          onChange={handleContentChange}
          readOnly={isBuiltin}
          placeholder="Write skill content here..."
          className="h-full"
        />
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className={cn(
      'text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0',
      source === 'builtin'
        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
        : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
    )}>
      {source === 'builtin' ? 'SYSTEM' : 'CUSTOM'}
    </span>
  );
}
