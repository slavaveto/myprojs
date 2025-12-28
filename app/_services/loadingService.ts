import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('AppLoader');

export const loadingService = {
    logAppInit() {
        logger.start('Initializing App Workspace...', {
            flow: { id: 'app_init', type: 'start', label: 'Start Initialization' }
        });
    },

    logProjectListLoaded(count: number) {
        logger.info(`Projects list loaded (${count} projects)`, {
            flow: { id: 'projects_loaded', parentId: 'app_init', type: 'process', label: 'Load Projects List' }
        });
    },

    logActiveProjectStart(title: string) {
        logger.start(`Loading ACTIVE project: ${title}`, {
            flow: { id: 'active_project_start', parentId: 'projects_loaded', type: 'process', label: 'Load Active Project' }
        });
    },

    logActiveProjectFinish(title: string) {
        logger.success(`Active project LOADED: ${title}`, {
            flow: { id: 'active_project_finish', parentId: 'active_project_start', type: 'success', label: 'Active Project Ready' }
        });
    },

    logTransitionToBackground(ms: number) {
        logger.info(`Active ready. Pause ${ms}ms before background load...`, {
            flow: { id: 'transition_background', parentId: 'active_project_finish', type: 'decision', label: 'Start Background Sync' }
        });
    },

    logBackgroundProjectStart(title: string) {
        logger.info(`Starting background load: ${title}`, {
            flow: { id: 'bg_project_start', parentId: 'transition_background', type: 'process', label: 'Load Background Project' }
        });
    },

    logBackgroundProjectFinish(title: string) {
        logger.info(`Background project loaded: ${title}`, {
            flow: { id: 'bg_project_finish', parentId: 'bg_project_start', type: 'success', label: 'Background Project Ready' }
        });
    },

    logSystemTabStart(name: string) {
        logger.info(`Loading system tab: ${name}`, {
            flow: { id: 'system_tab_start', parentId: 'transition_background', type: 'process', label: 'Load System Tab' }
        });
    },

    logSystemTabFinish(name: string, count: number) {
        logger.success(`${name} loaded (${count} items)`, {
            flow: { id: 'system_tab_finish', parentId: 'system_tab_start', type: 'success', label: 'System Tab Ready' }
        });
    },

    logAllFinished(totalProjects: number) {
        logger.success(`🚀 ALL SYSTEMS READY (${totalProjects} projects synced)`, {
            flow: { id: 'all_finished', parentId: 'transition_background', type: 'end', label: 'Initialization Complete' }
        });
    }
};
