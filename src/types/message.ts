export type ServiceType =
  | "gmail"
  | "slack"
  | "discord"
  | "x"
  | "instagram"
  | "line";

export interface UnifiedMessage {
  id: string;
  source: ServiceType;
  sourceId: string;
  threadId?: string;
  sender: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  channel?: string;
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
  timestamp: Date;
  isRead: boolean;
  openUrl: string;
  attachments?: Attachment[];
  raw?: unknown;
}

export interface Attachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface ServiceConnection {
  service: ServiceType;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
}
