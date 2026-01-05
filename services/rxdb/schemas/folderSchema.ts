import { 
    toTypedRxJsonSchema, 
    ExtractDocumentTypeFromTypedRxJsonSchema,
    RxJsonSchema 
} from 'rxdb';

export const folderSchemaLiteral = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            maxLength: 100
        },
        title: {
            type: 'string'
        },
        project_id: {
            type: 'string',
            maxLength: 100,
            ref: 'projects'
        },
        sort_order: {
            type: ['number', 'null']
        },
        is_deleted: {
            type: ['boolean', 'null']
        },
        created_at: {
            type: 'string',
            format: 'date-time'
        },
        updated_at: {
            type: 'string',
            format: 'date-time'
        }
    },
    required: ['id', 'title', 'project_id', 'created_at', 'updated_at'],
    indexes: ['project_id']
} as const;

const schemaTyped = toTypedRxJsonSchema(folderSchemaLiteral);
export type FolderDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTyped>;
export const folderSchema: RxJsonSchema<FolderDocType> = folderSchemaLiteral;
