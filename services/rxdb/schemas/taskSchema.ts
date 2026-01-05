import { 
    toTypedRxJsonSchema, 
    ExtractDocumentTypeFromTypedRxJsonSchema,
    RxJsonSchema
} from 'rxdb';

export const taskSchemaLiteral = {
    version: 1, // Incremented to fix DB6 schema mismatch
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            maxLength: 100
        },
        content: {
            type: 'string'
        },
        folder_id: {
            type: 'string',
            maxLength: 100,
            ref: 'folders'
        },
        sort_order: {
            type: 'number'
        },
        is_completed: {
            type: 'boolean'
        },
        is_deleted: {
            type: 'boolean'
        },
        task_type: {
            type: 'string' // 'task' | 'gap' | 'group' | 'note'
        },
        task_notes: {
            type: 'string'
        },
        title_text_style: {
            type: 'string'
        },
        is_today: {
            type: 'boolean'
        },
        group_id: {
            type: 'string',
            maxLength: 100
        },
        is_closed: {
            type: 'boolean' // For groups
        },
        created_at: {
            type: 'string',
            format: 'date-time'
        },
        updated_at: {
            type: 'string',
            format: 'date-time',
            maxLength: 100 // Required for index SC34
        },
        // UI fields (don't sync usually, but if we want persisted state...)
        // isNew, isDraft - лучше не хранить в БД, это runtime состояние
    },
    required: ['id', 'created_at', 'updated_at'],
    indexes: ['updated_at'] // folder_id removed from index as it's not required (DXE1)
} as const;

const schemaTyped = toTypedRxJsonSchema(taskSchemaLiteral);

export type TaskDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTyped>;

export const taskSchema: RxJsonSchema<TaskDocType> = taskSchemaLiteral;

