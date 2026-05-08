'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Terminal, Settings, Pencil, Trash2, Key, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { AgentTerminalTab, ensureGlobalListener, resetGlobalListener } from './AgentTerminalTab';
import { AgentChatView } from './AgentChatView';

type ViewMode = 'chat' | 'terminal';

const THEME_COLORS = {
  light: { bg: '#EEF0EE', border: '#d4d6d4', text: '#1a1a1a', textMuted: '#666', textDim: '#999', hover: '#dddedd', active: '#ccceca', input: '#f5f5f3', inputBorder: '#bbb' },
  dark: { bg: '#1a1a2e', border: '#333', text: '#e0e0e0', textMuted: '#808080', textDim: '#666', hover: '#2a2a4e', active: '#3a3a5e', input: '#12122a', inputBorder: '#444' },
};

interface AgentTerminal {
  agentId: string;
  agentName: string;
  displayName?: string;
  platform: string;
  status: 'running' | 'exited' | 'connecting';
  autoStartCommand?: string;
}

interface SidebarTerminalProps {
  agents: AgentTerminal[];
  selectedAgentId: string | null;
  terminalHeight: number;
  onTerminalHeightChange: (h: number) => void;
  onAgentExit: (agentId: string) => void;
  onDeleteAgent?: (agentId: string) => void;
  onRenameAgent?: (agentId: string, newName: string) => void;
  onResetToken?: (agentId: string) => void;
  colorTheme?: 'light' | 'dark';
  isElectron?: boolean;
}

export function SidebarTerminal({
  agents,
  selectedAgentId,
  terminalHeight,
  onTerminalHeightChange,
  onAgentExit,
  onDeleteAgent,
  onRenameAgent,
  onResetToken,
  colorTheme = 'light',
  isElectron = false,
}: SidebarTerminalProps) {
  const { t } = useT();
  const c = THEME_COLORS[colorTheme];
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [showSettings, setShowSettings] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmResetToken, setConfirmResetToken] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;
    ensureGlobalListener();
    api.onTerminalExit((agentId: string) => { onAgentExit(agentId); });
    return () => { api.removeTerminalListeners(); resetGlobalListener(); };
  }, [onAgentExit]);

  useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
        setConfirmDelete(false);
        setConfirmResetToken(false);
        setEditingName(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettings]);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startHeight: terminalHeight };
    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startY - ev.clientY;
      const newHeight = Math.min(Math.max(resizeRef.current.startHeight + delta, 120), window.innerHeight * 0.5);
      onTerminalHeightChange(newHeight);
    };
    const onMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [terminalHeight, onTerminalHeightChange]);

  if (!selectedAgentId) return null;

  const selectedAgent = agents.find(a => a.agentId === selectedAgentId);
  const agentLabel = selectedAgent?.displayName || selectedAgent?.agentName || selectedAgentId;

  return (
    <div className="flex flex-col shrink-0" style={{ height: terminalHeight, backgroundColor: c.bg }}>
      <div
        className="h-1 cursor-row-resize hover:bg-sidebar-primary/30 transition-colors shrink-0"
        onMouseDown={onResizeMouseDown}
      />

      {/* Title bar */}
      <div
        className="flex items-center h-8 px-2 shrink-0 gap-1"
        style={{ backgroundColor: c.bg, borderBottom: `1px solid ${c.border}` }}
      >
        <span className="text-[12px] font-medium truncate flex-1 pl-1" style={{ color: c.text }}>
          {agentLabel}
        </span>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setViewMode('chat')}
            className="p-1 rounded transition-colors"
            style={{
              color: viewMode === 'chat' ? c.text : c.textMuted,
              backgroundColor: viewMode === 'chat' ? c.active : 'transparent',
            }}
            title="Chat"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
          {isElectron && (
            <button
              onClick={() => {
                setViewMode('terminal');
                setTimeout(() => window.dispatchEvent(new Event('terminal:refit')), 50);
              }}
              className="p-1 rounded transition-colors"
              style={{
                color: viewMode === 'terminal' ? c.text : c.textMuted,
                backgroundColor: viewMode === 'terminal' ? c.active : 'transparent',
              }}
              title="Terminal"
            >
              <Terminal className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => {
              setShowSettings(v => !v);
              setConfirmDelete(false);
              setConfirmResetToken(false);
              setEditingName(false);
            }}
            className="p-1 rounded transition-colors"
            style={{ color: c.textMuted }}
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>

          {showSettings && (
            <div
              className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg py-1 min-w-[160px]"
              style={{ backgroundColor: c.hover, border: `1px solid ${c.border}` }}
            >
              {editingName ? (
                <div className="px-2 py-1.5 flex items-center gap-1">
                  <input
                    className="flex-1 text-[11px] px-1.5 py-0.5 rounded outline-none min-w-0"
                    style={{ backgroundColor: c.input, border: `1px solid ${c.inputBorder}`, color: c.text }}
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && nameValue.trim()) {
                        onRenameAgent?.(selectedAgentId, nameValue.trim());
                        setEditingName(false);
                        setShowSettings(false);
                      }
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (nameValue.trim()) {
                        onRenameAgent?.(selectedAgentId, nameValue.trim());
                        setEditingName(false);
                        setShowSettings(false);
                      }
                    }}
                    style={{ color: c.text }}
                    className="p-0.5"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setNameValue(agentLabel); setEditingName(true); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors text-left"
                  style={{ color: c.text }}
                >
                  <Pencil className="h-3 w-3" style={{ color: c.textMuted }} />
                  {t('actions.rename') || 'Rename'}
                </button>
              )}

              {confirmResetToken ? (
                <div className="px-3 py-1.5 flex items-center gap-1">
                  <span className="text-[10px] flex-1" style={{ color: c.textDim }}>{t('actions.resetTokenConfirm') || 'Reset token?'}</span>
                  <button onClick={() => { onResetToken?.(selectedAgentId); setConfirmResetToken(false); setShowSettings(false); }}
                    className="px-1.5 py-0.5 text-[10px] font-medium text-white bg-red-500 rounded hover:bg-red-600">
                    {t('common.confirm') || 'Confirm'}
                  </button>
                  <button onClick={() => setConfirmResetToken(false)}
                    className="px-1.5 py-0.5 text-[10px] font-medium rounded"
                    style={{ color: c.textDim, backgroundColor: c.active }}>
                    {t('common.cancel') || 'Cancel'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmResetToken(true)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors text-left"
                  style={{ color: c.text }}
                >
                  <Key className="h-3 w-3" style={{ color: c.textMuted }} />
                  {t('actions.resetToken') || 'Reset Token'}
                </button>
              )}

              <div className="my-0.5" style={{ borderTop: `1px solid ${c.border}` }} />

              {confirmDelete ? (
                <div className="px-3 py-1.5 flex items-center gap-1">
                  <span className="text-[10px] flex-1" style={{ color: c.textDim }}>{t('actions.confirmDelete') || 'Delete?'}</span>
                  <button onClick={() => { onDeleteAgent?.(selectedAgentId); setConfirmDelete(false); setShowSettings(false); }}
                    className="px-1.5 py-0.5 text-[10px] font-medium text-white bg-red-500 rounded hover:bg-red-600">
                    {t('actions.delete') || 'Delete'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="px-1.5 py-0.5 text-[10px] font-medium rounded"
                    style={{ color: c.textDim, backgroundColor: c.active }}>
                    {t('common.cancel') || 'Cancel'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-400 transition-colors text-left"
                >
                  <Trash2 className="h-3 w-3" />
                  {t('actions.delete') || 'Delete'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === 'chat' && (
          <AgentChatView
            agentId={selectedAgentId}
            agentName={agentLabel}
            isActive={true}
            colorTheme={colorTheme}
          />
        )}
        {viewMode === 'terminal' && isElectron && agents.map(agent => (
          <AgentTerminalTab
            key={agent.agentId}
            agentId={agent.agentId}
            isActive={selectedAgentId === agent.agentId}
            colorTheme={colorTheme}
            autoStartCommand={agent.autoStartCommand}
          />
        ))}
      </div>
    </div>
  );
}
