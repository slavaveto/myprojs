// utils/logger/LogsManager/RightPanel/types.ts
export interface LoggerInfo {
   name: string;
   color: string;
   file: string;
   line: number;
}

export interface LoggerCallInfo {
   componentName: string;
   method: string;
   message: string;
   file: string;
   line: number;
   providedLine?: number;
   data?: string;
}

export interface LoggerConfig {
   enabled: boolean;
   color: string;
   lastChanged?: number;
   createdAt?: number;
   filePath?: string;
}

export type SortField = 'line' | 'created' | 'message';
export type SortDirection = 'asc' | 'desc';

export interface PageLoggerPanelProps {
   selectedPage: string;
   selectedComponent: { name: string; file: string } | null;
   selectedFolder: string | null;
   loggers: LoggerInfo[];
   loggerCalls: LoggerCallInfo[];
   loggerConfigs: Record<string, LoggerConfig>;
   updateLoggerConfig: (logger: LoggerInfo, config: Partial<LoggerConfig>) => void;
   updateLoggerCallConfig: (loggerCall: LoggerCallInfo, config: Partial<LoggerConfig>) => void;
   getLoggerKey: (logger: LoggerInfo) => string;
   getLoggerCallKey: (loggerCall: LoggerCallInfo) => string;
   getLoggerCallConfigKey: (loggerCall: LoggerCallInfo) => string;
   folderFilters: Set<string>;
   tabHeight: number;
   pinnedLogs: string[];
   setPinnedLogs: (logs: string[] | ((prev: string[]) => string[])) => void;
   componentLastViewed: Record<string, number>;
   onDeleteLog: (file: string, line: number) => Promise<void>;
   onEditLog: (file: string, line: number, newMessage: string, newMethod: string) => Promise<void>;
   selectedTab: string;
   pinnedComponents: string[];
   highlightedLogKey?: string | null; // Added highlightedLogKey
}

