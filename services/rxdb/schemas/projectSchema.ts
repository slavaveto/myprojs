import { 
    toTypedRxJsonSchema, 
    ExtractDocumentTypeFromTypedRxJsonSchema,
    RxJsonSchema
} from 'rxdb';

export const projectSchemaLiteral = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            maxLength: 100 // Primary keys needs maxLength in RxDB
        },
        title: {
            type: 'string'
        },
        proj_color: {
            type: 'string'
        },
        sort_order: {
            type: 'number'
        },
        is_highlighted: {
            type: 'boolean'
        },
        created_at: {
            type: 'string',
            format: 'date-time'
        },
        updated_at: {
            type: 'string',
            format: 'date-time'
        },
        is_deleted: {
            type: 'boolean'
        },
        is_disabled: {
            type: 'boolean'
        },
        proj_type: {
            type: 'string' // 'personal' | 'ui' | 'docs' etc
        },
        parent_proj_id: {
            type: 'string'
        },
        remote_proj_slug: {
            type: 'string'
        }
    },
    required: ['id', 'title', 'created_at', 'updated_at']
} as const;

const schemaTyped = toTypedRxJsonSchema(projectSchemaLiteral);

export type ProjectDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTyped>;

export const projectSchema: RxJsonSchema<ProjectDocType> = projectSchemaLiteral;

