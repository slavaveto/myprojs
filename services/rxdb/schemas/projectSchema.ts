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
            maxLength: 100
        },
        user_id: {
            type: ['string', 'null'],
            maxLength: 100
        },
        title: {
            type: 'string'
        },
        proj_color: {
            type: ['string', 'null']
        },
        sort_order: {
            type: ['number', 'null']
        },
        is_highlighted: {
            type: ['boolean', 'null']
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
            type: ['boolean', 'null']
        },
        is_disabled: {
            type: ['boolean', 'null']
        },
        proj_type: {
            type: ['string', 'null']
        },
        parent_proj_id: {
            type: ['string', 'null']
        },
        remote_proj_slug: {
            type: ['string', 'null']
        }
    },
    required: ['id', 'title', 'created_at', 'updated_at']
} as const;

const schemaTyped = toTypedRxJsonSchema(projectSchemaLiteral);
export type ProjectDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTyped>;
export const projectSchema: RxJsonSchema<ProjectDocType> = projectSchemaLiteral;
