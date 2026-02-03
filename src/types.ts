export interface SyncPathConfig {
  remotePath: string;  // Path on Gateway (e.g., "notes")
  localPath: string;   // Path in vault (e.g., "RentHero/Notes")
  enabled: boolean;
}

// Hardcoded vault structure — update here, push to repo, everyone gets it
export const RENTHERO_SYNC_PATHS: SyncPathConfig[] = [
  { remotePath: "docs",      localPath: "RentHero/Docs",      enabled: true },
  { remotePath: "repos",     localPath: "RentHero/Repos",     enabled: true },
  { remotePath: "decisions", localPath: "RentHero/Decisions",  enabled: true },
  { remotePath: "projects",  localPath: "RentHero/Projects",   enabled: true },
  { remotePath: "notes",     localPath: "RentHero/Notes",      enabled: true },
  { remotePath: "trello",    localPath: "RentHero/Trello",     enabled: true },
  { remotePath: "templates", localPath: "RentHero/Templates",  enabled: true },
  { remotePath: "inbox",     localPath: "RentHero/Inbox",      enabled: true },
];

export interface RennieSettings {
  gatewayUrl: string;
  // Token storage - uses encrypted if available, falls back to plaintext
  gatewayTokenEncrypted: string | null;
  gatewayTokenPlaintext: string;
  showActionsInChat: boolean;
  auditLogEnabled: boolean;
  auditLogPath: string;
  // Sync settings
  syncEnabled: boolean;
  syncServerUrl: string;
  syncPaths: SyncPathConfig[];
  syncInterval: number; // minutes, 0 = manual only
  syncConflictBehavior: "ask" | "preferLocal" | "preferRemote";
}

export const DEFAULT_SETTINGS: RennieSettings = {
  gatewayUrl: "https://rennie.renthero.com/api",
  gatewayTokenEncrypted: null,
  gatewayTokenPlaintext: "",
  showActionsInChat: false,
  auditLogEnabled: false,
  auditLogPath: "RentHero/audit-log.md",
  // Sync defaults
  syncEnabled: true,
  syncServerUrl: "https://rennie.renthero.com",
  syncPaths: [...RENTHERO_SYNC_PATHS],
  syncInterval: 15,
  syncConflictBehavior: "ask",
};

export interface SyncFileState {
  path: string;
  hash: string;
  modified: string;
  size: number;
}

export interface SyncConflict {
  localPath: string;
  remotePath: string;
  localFile: SyncFileState & { content: string };
  remoteFile: SyncFileState & { content: string };
}

export type RennieAction =
  | { action: "createFile"; path: string; content: string }
  | { action: "updateFile"; path: string; content: string }
  | { action: "appendToFile"; path: string; content: string }
  | { action: "deleteFile"; path: string }
  | { action: "renameFile"; path: string; newPath: string }
  | { action: "openFile"; path: string };

export interface ChatMessage {
  role: "user" | "assistant" | "error";
  content: string;
  timestamp: number;
  actions?: RennieAction[];
}

export interface ChatResponse {
  text: string;
  actions: RennieAction[];
}
