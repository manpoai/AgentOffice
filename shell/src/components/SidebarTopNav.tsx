'use client';

import { cn } from '@/lib/utils';

export type SidebarTab = 'files' | 'tasks' | 'skills' | 'memory';

const TAB_ROUTES: Record<SidebarTab, string> = {
  files: '/content',
  tasks: '/tasks',
  skills: '/skills',
  memory: '/memory',
};

export function tabFromPathname(pathname: string): SidebarTab {
  if (pathname.startsWith('/tasks')) return 'tasks';
  if (pathname.startsWith('/skills')) return 'skills';
  if (pathname.startsWith('/memory')) return 'memory';
  return 'files';
}

export { TAB_ROUTES };

interface SidebarTopNavProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onNotificationsClick: () => void;
  onSettingsClick: () => void;
  unreadCount: number;
  isElectron?: boolean;
}

function DocsIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M3.75 1C3.05933 1 2.5 1.56 2.5 2.25V13.75C2.5 14.44 3.06 15 3.75 15H12.25C12.94 15 13.5 14.44 13.5 13.75V8.5C13.5 7.83696 13.2366 7.20107 12.7678 6.73223C12.2989 6.26339 11.663 6 11 6H9.75C9.41848 6 9.10054 5.8683 8.86612 5.63388C8.6317 5.39946 8.5 5.08152 8.5 4.75V3.5C8.5 2.83696 8.23661 2.20107 7.76777 1.73223C7.29893 1.26339 6.66304 1 6 1H3.75Z" fill="#2FCC71"/>
      <path d="M8.64746 1.21045C9.19847 1.84576 9.5013 2.65881 9.50013 3.49978V4.74978C9.50013 4.88778 9.61213 4.99978 9.75013 4.99978H11.0001C11.8411 4.99862 12.6542 5.30144 13.2895 5.85245C12.9962 4.73692 12.4118 3.71932 11.5962 2.90371C10.7806 2.0881 9.76299 1.50376 8.64746 1.21045Z" fill="#76ED7E"/>
    </svg>
  );
}

function TasksIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M5.00146 4H9.75347C10.3496 4.00088 10.9211 4.23833 11.3423 4.66019C11.7635 5.08205 12.0001 5.65384 12.0001 6.25V12.5C12.5306 12.5 13.0393 12.2893 13.4143 11.9142C13.7894 11.5391 14.0001 11.0304 14.0001 10.5V4.072C14.0001 3.06867 13.2501 2.198 12.2241 2.112C12.0747 2.09986 11.9251 2.08875 11.7755 2.07867C11.6067 1.75353 11.3519 1.48098 11.0388 1.29076C10.7258 1.10054 10.3665 0.999966 10.0001 1H9.00013C8.63381 0.999966 8.27451 1.10054 7.96144 1.29076C7.64837 1.48098 7.39355 1.75353 7.2248 2.07867C7.0748 2.08867 6.9248 2.1 6.77613 2.112C5.7748 2.19667 5.03613 3.028 5.00146 4ZM9.00013 2C8.73492 2 8.48056 2.10536 8.29302 2.29289C8.10549 2.48043 8.00013 2.73478 8.00013 3H11.0001C11.0001 2.73478 10.8948 2.48043 10.7072 2.29289C10.5197 2.10536 10.2653 2 10.0001 2H9.00013Z" fill="currentColor" fillOpacity="0.3"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M2 6.25C2 5.55933 2.56 5 3.25 5H9.75C10.4407 5 11 5.56 11 6.25V13.75C11 14.44 10.44 15 9.75 15H3.25C2.91848 15 2.60054 14.8683 2.36612 14.6339C2.1317 14.3995 2 14.0815 2 13.75V6.25ZM8.39067 9.31267C8.47359 9.20906 8.51196 9.07675 8.49733 8.94485C8.4827 8.81295 8.41628 8.69226 8.31267 8.60933C8.20906 8.52641 8.07675 8.48804 7.94485 8.50267C7.81295 8.5173 7.69226 8.58372 7.60933 8.68733L5.95867 10.7513L5.35333 10.1467C5.25855 10.0583 5.13319 10.0103 5.00365 10.0125C4.87412 10.0148 4.75053 10.0673 4.65892 10.1589C4.56731 10.2505 4.51484 10.3741 4.51255 10.5037C4.51026 10.6332 4.55835 10.7586 4.64667 10.8533L5.64667 11.8533C5.6964 11.9031 5.75606 11.9417 5.82175 11.9668C5.88744 11.9919 5.95769 12.0029 6.02791 11.999C6.09812 11.9951 6.16672 11.9764 6.22923 11.9442C6.29174 11.912 6.34675 11.8669 6.39067 11.812L8.39067 9.31267Z" fill="currentColor" fillOpacity="0.3"/>
    </svg>
  );
}

function SkillsIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M8 1L2 4.5V11.5L8 15L14 11.5V4.5L8 1Z" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 5V11" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M5 6.5L8 5L11 6.5" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 9.5L8 11L11 9.5" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function MemoryIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M8 1C4.68629 1 2 3.13401 2 5.75C2 7.47589 3.06355 8.98656 4.66667 9.83333V13L7.33333 11.3333H8C11.3137 11.3333 14 9.19929 14 6.58333C14 3.96738 11.3137 1 8 1Z" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="5.5" cy="6" r="0.75" fill="currentColor" fillOpacity="0.4"/>
      <circle cx="8" cy="6" r="0.75" fill="currentColor" fillOpacity="0.4"/>
      <circle cx="10.5" cy="6" r="0.75" fill="currentColor" fillOpacity="0.4"/>
    </svg>
  );
}

function SettingIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M9.3335 11.3335H3.3335" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.6665 4.6665H6.6665" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.3335 13.3335C12.4381 13.3335 13.3335 12.4381 13.3335 11.3335C13.3335 10.2289 12.4381 9.3335 11.3335 9.3335C10.2289 9.3335 9.3335 10.2289 9.3335 11.3335C9.3335 12.4381 10.2289 13.3335 11.3335 13.3335Z" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.6665 6.6665C5.77107 6.6665 6.6665 5.77107 6.6665 4.6665C6.6665 3.56193 5.77107 2.6665 4.6665 2.6665C3.56193 2.6665 2.6665 3.56193 2.6665 4.6665C2.6665 5.77107 3.56193 6.6665 4.6665 6.6665Z" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function NotificationIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M6.84521 14C6.96224 14.2027 7.13056 14.371 7.33324 14.488C7.53593 14.605 7.76584 14.6666 7.99988 14.6666C8.23392 14.6666 8.46383 14.605 8.66652 14.488C8.8692 14.371 9.03752 14.2027 9.15455 14" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.17467 10.2175C2.08758 10.313 2.0301 10.4317 2.00924 10.5592C1.98837 10.6867 2.00501 10.8175 2.05714 10.9358C2.10926 11.054 2.19462 11.1545 2.30284 11.2251C2.41105 11.2958 2.53745 11.3334 2.66667 11.3335H13.3333C13.4625 11.3335 13.589 11.296 13.6972 11.2256C13.8055 11.1551 13.891 11.0547 13.9433 10.9365C13.9955 10.8183 14.0123 10.6876 13.9916 10.56C13.9709 10.4325 13.9136 10.3137 13.8267 10.2182C12.94 9.30416 12 8.33283 12 5.3335C12 4.27263 11.5786 3.25521 10.8284 2.50507C10.0783 1.75492 9.06087 1.3335 8 1.3335C6.93914 1.3335 5.92172 1.75492 5.17157 2.50507C4.42143 3.25521 4 4.27263 4 5.3335C4 8.33283 3.05933 9.30416 2.17467 10.2175Z" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function AoseLogo({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <mask id="mask0_logo" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="17" y="5" width="130" height="100">
        <rect width="130" height="100" transform="matrix(1 0 0 -1 17 105)" fill="white"/>
      </mask>
      <g mask="url(#mask0_logo)">
        <circle cx="78" cy="80" r="56" stroke="currentColor" strokeWidth="8"/>
      </g>
      <g opacity="0.3">
        <mask id="mask1_logo" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="13" y="113" width="130" height="32">
          <rect x="13" y="113" width="130" height="32" fill="white"/>
        </mask>
        <g mask="url(#mask1_logo)">
          <circle cx="78" cy="80" r="56" stroke="currentColor" strokeWidth="8"/>
        </g>
      </g>
    </svg>
  );
}

export function SidebarTopNav({ activeTab, onTabChange, onNotificationsClick, onSettingsClick, unreadCount, isElectron }: SidebarTopNavProps) {
  return (
    <div className="flex items-center justify-between px-3 pt-2 pb-1 shrink-0" style={{ WebkitAppRegion: 'drag', paddingTop: isElectron ? '10px' : '8px' } as React.CSSProperties}>
      {/* Left: traffic lights (Electron) or AOSE logo (web) */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {isElectron ? (
          <div className="w-[60px]" />
        ) : (
          <AoseLogo className="h-5 w-5 text-foreground/70" />
        )}
      </div>

      {/* Right: docs, tasks | setting, notifications */}
      <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => onTabChange('files')}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            activeTab === 'files'
              ? 'bg-sidebar-primary/10 text-sidebar-primary'
              : 'text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
          )}
          title="Files"
        >
          <DocsIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => onTabChange('tasks')}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            activeTab === 'tasks'
              ? 'bg-sidebar-primary/10 text-sidebar-primary'
              : 'text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
          )}
          title="Tasks"
        >
          <TasksIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => onTabChange('skills')}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            activeTab === 'skills'
              ? 'bg-sidebar-primary/10 text-sidebar-primary'
              : 'text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
          )}
          title="Skills"
        >
          <SkillsIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => onTabChange('memory')}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            activeTab === 'memory'
              ? 'bg-sidebar-primary/10 text-sidebar-primary'
              : 'text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
          )}
          title="Memory"
        >
          <MemoryIcon className="h-4 w-4" />
        </button>

        <div className="w-px h-3 bg-black/10 dark:bg-white/10 mx-1" />

        <button
          onClick={onSettingsClick}
          className="p-1.5 rounded-md text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          title="Settings"
        >
          <SettingIcon className="h-4 w-4" />
        </button>
        <button
          onClick={onNotificationsClick}
          className="p-1.5 rounded-md text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors relative"
          title="Notifications"
        >
          <NotificationIcon className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 rounded-full bg-red-500 text-white text-[9px] font-medium flex items-center justify-center px-0.5">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
