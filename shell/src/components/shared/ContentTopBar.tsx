'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ArrowLeftToLine, ArrowRightToLine, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ContentTopBarProps {
  // Navigation
  breadcrumb?: { id: string; title: string }[];
  onNavigate?: (id: string) => void;
  onBack?: () => void;

  // Sidebar toggle
  docListVisible?: boolean;
  onToggleDocList?: () => void;

  // Title
  title: string;
  titlePlaceholder?: string;
  onTitleChange?: (title: string) => void; // if provided, title is editable

  // Metadata line
  metaLine?: React.ReactNode;

  // Right-side actions slot
  actions?: React.ReactNode;

  // Save status indicator
  statusText?: string;
  statusError?: boolean;
}

export function ContentTopBar({
  breadcrumb,
  onNavigate,
  onBack,
  docListVisible,
  onToggleDocList,
  title,
  titlePlaceholder = 'Untitled',
  onTitleChange,
  metaLine,
  actions,
  statusText,
  statusError,
}: ContentTopBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const startEdit = () => {
    if (!onTitleChange) return;
    setEditValue(title);
    setIsEditing(true);
  };

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onTitleChange?.(trimmed);
    }
    setIsEditing(false);
  };

  // Build parent crumbs (all except last) and the title crumb
  const parentCrumbs = breadcrumb && breadcrumb.length > 1 ? breadcrumb.slice(0, -1) : [];

  return (
    <div className="flex-1 min-w-0 flex items-center px-4 py-2">
      {/* Sidebar toggle — desktop only */}
      {onToggleDocList && (
        <button
          onClick={onToggleDocList}
          className="hidden md:flex p-1.5 -ml-1 mr-1 text-muted-foreground hover:text-foreground rounded transition-colors"
          title={docListVisible ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {docListVisible ? <ArrowLeftToLine className="h-4 w-4" /> : <ArrowRightToLine className="h-4 w-4" />}
        </button>
      )}

      {/* Back button — mobile only */}
      {onBack && (
        <button onClick={onBack} className="md:hidden p-1.5 -ml-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}

      {/* Breadcrumb + title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 text-sm">
          {/* Parent breadcrumb items */}
          {parentCrumbs.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
              {onNavigate ? (
                <button onClick={() => onNavigate(crumb.id)} className="text-muted-foreground hover:text-foreground truncate">
                  {crumb.title}
                </button>
              ) : (
                <span className="text-muted-foreground truncate">{crumb.title}</span>
              )}
            </span>
          ))}

          {/* Separator before title if there are parents */}
          {parentCrumbs.length > 0 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          )}

          {/* Title — editable or static */}
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              className="text-sm font-medium bg-transparent text-foreground outline-none border-b border-sidebar-primary flex-1 min-w-[100px]"
              autoFocus
            />
          ) : onTitleChange ? (
            <button
              onClick={startEdit}
              onDoubleClick={startEdit}
              className="text-foreground font-medium truncate cursor-pointer hover:text-sidebar-primary transition-colors"
            >
              {title || titlePlaceholder}
            </button>
          ) : (
            <span className="text-foreground font-medium truncate">{title || titlePlaceholder}</span>
          )}
        </div>

        {/* Meta line */}
        {metaLine && (
          <div className="mt-0.5">
            {metaLine}
          </div>
        )}
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {statusText && (
          <span className={cn('text-[10px]', statusError ? 'text-destructive' : 'text-muted-foreground')}>
            {statusText}
          </span>
        )}
        {actions}
      </div>
    </div>
  );
}
