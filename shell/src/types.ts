// Stub for Outline's types module
export type NavigationNode = {
  id: string;
  title: string;
  url: string;
  children: NavigationNode[];
  emoji?: string;
  color?: string;
};

export type MenuItem = {
  title: string;
  icon?: React.ComponentType;
  onClick?: () => void;
  href?: string;
  visible?: boolean;
  disabled?: boolean;
  separator?: boolean;
};

export type Toast = {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  timeout?: number;
};

export enum TeamPreference {
  SeamlessEdit = 'seamlessEdit',
  ViewersCanExport = 'viewersCanExport',
}

export enum UserPreference {
  RememberLastPath = 'rememberLastPath',
  UseCursorPointer = 'useCursorPointer',
  CodeBlockLineNumbers = 'codeBlockLineNumbers',
}

export type EmbedDescriptor = {
  title: string;
  matcher: (url: string) => boolean;
  component: React.ComponentType<any>;
  icon?: React.ComponentType;
};

export enum IntegrationService {
  Diagrams = 'diagrams',
  Grist = 'grist',
  GoogleDocs = 'google-docs',
  GoogleSheets = 'google-sheets',
  GoogleSlides = 'google-slides',
  GitHub = 'github',
  GitLab = 'gitlab',
  Slack = 'slack',
}

export type IntegrationSettings = {
  url?: string;
  [key: string]: any;
};

export type IntegrationType = {
  id: string;
  name: string;
  settings?: IntegrationSettings;
};

export enum MentionType {
  User = 'user',
  Document = 'document',
  Collection = 'collection',
  Group = 'group',
  Issue = 'issue',
  PullRequest = 'pull_request',
  Project = 'project',
  URL = 'url',
}

export type UnfurlResourceType = string;

export type UnfurlResponse = {
  url: string;
  type: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
};
