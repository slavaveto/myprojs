import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('AdminLoader');

export const adminLoadingService = {
    logInit() {
        logger.start('Initializing Admin Panel...', {
            flow: { id: 'admin_init', type: 'start', label: 'Admin Init' }
        });
    },

    logActiveTabStart(tabId: string) {
        logger.info(`Loading Active Admin Tab: ${tabId}`, {
             flow: { id: 'admin_active_start', parentId: 'admin_init', type: 'process', label: `Load ${tabId}` }
        });
    },

    logActiveTabFinish(tabId: string) {
        logger.success(`Active Tab Ready: ${tabId}`, {
             flow: { id: 'admin_active_finish', parentId: 'admin_active_start', type: 'success', label: `${tabId} Ready` }
        });
    },

    logTransitionToBackground(ms: number) {
        logger.info(`Active ready. Pause ${ms}ms before background load...`, {
            flow: { id: 'admin_transition_bg', parentId: 'admin_active_finish', type: 'decision', label: 'Start Background Sync' }
        });
    },

    logBackgroundTabStart(tabId: string) {
         logger.info(`Starting background tab: ${tabId}`, {
             flow: { id: 'admin_bg_start', parentId: 'admin_transition_bg', type: 'process', label: `Load BG ${tabId}` }
        });
    },

    logBackgroundTabFinish(tabId: string) {
         logger.success(`Background tab loaded: ${tabId}`, {
             flow: { id: 'admin_bg_finish', parentId: 'admin_bg_start', type: 'success', label: `BG ${tabId} Ready` }
        });
    },

    logAllFinished() {
        logger.success('🚀 ALL ADMIN TABS READY', {
             flow: { id: 'admin_all_finished', parentId: 'admin_transition_bg', type: 'end', label: 'Admin Ready' }
        });
    }
};

