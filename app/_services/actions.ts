export const BaseActions = {
    CREATE: 'create',
    CREATE_INBOX: 'create_inbox',
    DELETE: 'delete',
    UPDATE: 'update',
    REORDER: 'reorder',
    COMPLETE: 'complete',
    RESTORE: 'restore',
} as const;

export const EntityTypes = {
    PROJECT: 'project',
    FOLDER: 'folder',
    TASK: 'task',
} as const;

export const ProjectUpdateTypes = {
    RENAME: 'rename',
    RECOLOR: 'recolor',
    UPDATE_SETTINGS: 'update_settings',
} as const;

export const FolderUpdateTypes = {
    RENAME: 'rename',
} as const;

export const TaskUpdateTypes = {
    RENAME: 'rename',
    MOVE: 'move',
    PIN: 'pin',
    UNPIN: 'unpin',
    MARK_TODAY: 'mark_today',
    UNMARK_TODAY: 'unmark_today',
    TASK_TYPE_CHANGE: 'task_type_change',
    TITLE_STYLE_CHANGE: 'title_style_change',
    GROUP_RECOLOR: 'group_recolor',
} as const;

export type BaseActionType = typeof BaseActions[keyof typeof BaseActions];
