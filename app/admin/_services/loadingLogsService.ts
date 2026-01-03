import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('AdminLoader');

export const adminLoadingService = {
    logInit() {
        logger.start('Initializing Admin Panel...');
    },

    logActiveTabStart(tabId: string) {
        logger.info(`Loading Active Admin Tab: ${tabId}`);
    },

    logActiveTabFinish(tabId: string) {
        logger.success(`Active Tab Ready: ${tabId}`);
    },

    logTransitionToBackground(ms: number) {
        logger.info(`Active ready. Pause ${ms}ms before background load...`);
    },

    logBackgroundTabStart(tabId: string) {
         logger.info(`Starting background tab: ${tabId}`);
    },

    logBackgroundTabFinish(tabId: string) {
         logger.success(`Background tab loaded: ${tabId}`);
    },

    logAllFinished() {
        logger.success('🚀 ALL ADMIN TABS READY');
    }
};

