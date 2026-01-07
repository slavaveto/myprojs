import { column, Schema, Table } from '@powersync/web';

export const AppSchema = new Schema({
  projects: new Table({
    title: column.text,
    proj_color: column.text,
    sort_order: column.integer,
    created_at: column.text,
    updated_at: column.text,
    local_path: column.text,
    proj_type: column.text,
    parent_proj_id: column.text,
    is_deleted: column.integer, // boolean as 0 or 1
    is_disabled: column.integer,
    is_highlighted: column.integer,
    is_hidden: column.integer, // boolean as 0 or 1
    remote_proj_slug: column.text,
  }),
  folders: new Table({
    project_id: column.text,
    title: column.text,
    sort_order: column.integer,
    created_at: column.text,
    updated_at: column.text,
    is_deleted: column.integer,
    is_hidden: column.integer,
  }),
});

export type Database = (typeof AppSchema)['types'];

