import { createLogger } from '@/utils/logger/Logger';
import { createLoggerNext } from '@/utils/loggerNext/LoggerNext';

const logger = createLogger('AppLoader');
const loggerNext = createLoggerNext('AppLoader');

export const loadingService = {
    logAppInit() {
        logger.start('Initializing App Workspace...');
        loggerNext.start('Initializing App Workspace...');
    },

    logProjectListLoaded(count: number) {
        logger.info(`Projects list loaded (${count} projects)`);
        loggerNext.info(`Projects list loaded (${count} projects)`);
    },

    logActiveProjectStart(title: string) {
        logger.start(`Loading ACTIVE project: ${title}`);
        loggerNext.start(`Loading ACTIVE project: ${title}`);
    },

    logActiveProjectFinish(title: string) {
        logger.success(`Active project LOADED: ${title}`);
        loggerNext.success(`Active project LOADED: ${title}`);
    },

    logBackgroundProjectStart(title: string) {
        logger.info(`Starting background load: ${title}`);
        loggerNext.info(`Starting background load: ${title}`);
    },

    logBackgroundProjectFinish(title: string) {
        logger.info(`Background project loaded: ${title}`);
        loggerNext.info(`Background project loaded: ${title}`);
    },

    logTransitionToBackground(ms: number) {
        logger.info(`Active ready. Pause ${ms}ms before background load...`);
        loggerNext.info(`Active ready. Pause ${ms}ms before background load...`);
    },

    logSystemTabStart(name: string) {
        logger.info(`Loading system tab: ${name}`);
        loggerNext.info(`Loading system tab: ${name}`);
    },

    logSystemTabFinish(name: string, count: number) {
        logger.success(`${name} loaded (${count} items)`);
        loggerNext.success(`${name} loaded (${count} items)`);
    },

    logAllFinished(totalProjects: number) {
        logger.success(`🚀 ALL SYSTEMS READY (${totalProjects} projects synced)`);
        loggerNext.success(`🚀 ALL SYSTEMS READY (${totalProjects} projects synced)`);
    }
};

