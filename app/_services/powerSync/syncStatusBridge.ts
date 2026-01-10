import { EventEmitter } from 'events';

// Тип статуса, совместимый с PowerSync SyncStatus
export interface SimpleSyncStatus {
    connected: boolean;
    connecting: boolean;
    downloading: boolean;
    uploading: boolean;
    lastSyncedAt?: Date;
    anyError?: Error;
    dataFlow?: {
        uploading: boolean;
        downloading: boolean;
        uploadError?: any;
        downloadError?: any;
    };
    isHealthy?: boolean; // New: Connection health check
    consecutiveFailures?: number;
    projectTitle?: string;
}

class SyncStatusBridge extends EventEmitter {
    private statuses = new Map<string, SimpleSyncStatus>();

    updateStatus(projectId: string, status: SimpleSyncStatus) {
        this.statuses.set(projectId, status);
        this.emit('change', this.statuses);
    }

    getStatuses() {
        return this.statuses;
    }
    
    getStatus(projectId: string) {
        return this.statuses.get(projectId);
    }

    clear(projectId?: string) {
        if (projectId) {
            this.statuses.delete(projectId);
        } else {
            this.statuses.clear();
        }
        this.emit('change', this.statuses);
    }
}

export const syncBridge = new SyncStatusBridge();

