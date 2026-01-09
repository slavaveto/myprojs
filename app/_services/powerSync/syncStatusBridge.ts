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
}

class SyncStatusBridge extends EventEmitter {
    private currentStatus: SimpleSyncStatus | null = null;

    updateStatus(status: SimpleSyncStatus) {
        this.currentStatus = status;
        this.emit('change', status);
    }

    getStatus() {
        return this.currentStatus;
    }

    clear() {
        this.currentStatus = null;
        this.emit('change', null);
    }
}

export const syncBridge = new SyncStatusBridge();

