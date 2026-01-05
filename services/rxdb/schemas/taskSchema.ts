import { 
    toTypedRxJsonSchema, 
    ExtractDocumentTypeFromTypedRxJsonSchema,
    RxJsonSchema 
} from 'rxdb';

export const taskSchemaLiteral = {
    version: 2, // V2: Added user_id
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            maxLength: 100
        },
        user_id: {
            type: ['string', 'null'],
            maxLength: 100
        },
        content: {
            type: 'string'
        },
        folder_id: {
            type: ['string', 'null'], // Can be null (Inbox)
            maxLength: 100,
            ref: 'folders'
        },
        sort_order: {
            type: ['number', 'null']
        },
        is_completed: {
            type: ['boolean', 'null']
        },
        is_deleted: {
            type: ['boolean', 'null']
        },
        task_type: {
            type: ['string', 'null']
        },
        task_notes: {
            type: ['string', 'null']
        },
        title_text_style: {
            type: ['string', 'null']
        },
        is_today: {
            type: ['boolean', 'null']
        },
        group_id: {
            type: ['string', 'null'],
            maxLength: 100
        },
        is_closed: {
            type: ['boolean', 'null']
        },
        created_at: {
            type: 'string',
            format: 'date-time'
        },
        updated_at: {
            type: 'string',
            format: 'date-time',
            maxLength: 100
        },
    },
    required: ['id', 'created_at', 'updated_at'],
    indexes: ['updated_at'] // Only required fields in index for Dexie
} as const;

const schemaTyped = toTypedRxJsonSchema(taskSchemaLiteral);
export type TaskDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTyped>;
export const taskSchema: RxJsonSchema<TaskDocType> = taskSchemaLiteral;
