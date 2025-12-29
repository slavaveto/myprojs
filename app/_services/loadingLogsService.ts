import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('AppLoader');

export const loadingService = {
    logAppInit() {
        logger.start('Initializing App Workspace...');
    },

    logProjectListLoaded(count: number) {
        logger.info(`Projects list loaded (${count} projects)`);
    },

    logActiveProjectStart(title: string) {
        logger.start(`Loading ACTIVE project: ${title}`);
    },

    logActiveProjectFinish(title: string) {
        logger.success(`Active project LOADED: ${title}`);
    },

    logTransitionToBackground(ms: number) {
        logger.info(`Active ready. Pause ${ms}ms before background load...`);
    },

    logBackgroundProjectStart(title: string) {
        logger.info(`Starting background load: ${title}`);
    },

    logBackgroundProjectFinish(title: string) {
        logger.success(`Background project loaded: ${title}`);
    },

    logDocsScreenStart(title: string) {
        logger.info(`Loading Docs for project: ${title}`);
    },

    logDocsScreenFinish(title: string) {
        logger.success(`Docs LOADED for: ${title}`);
    },

    logSystemTabStart(name: string) {
        logger.info(`Loading system tab: ${name}`);
    },

    logSystemTabFinish(name: string, count: number) {
        logger.success(`${name} loaded (${count} items)`);
    },

    logAllFinished(totalProjects: number) {
        logger.success(`🚀 ALL SYSTEMS READY (${totalProjects} projects synced)`);
    }
};
