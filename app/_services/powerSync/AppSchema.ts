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
    is_deleted: column.integer, // boolean as 0 or 1
    is_highlighted: column.integer,
    is_hidden: column.integer, // boolean as 0 or 1
    has_remote: column.integer,
    parent_proj_id: column.text,
  }),
  folders: new Table({
    project_id: column.text,
    title: column.text,
    sort_order: column.integer,
    created_at: column.text,
    updated_at: column.text,
    is_deleted: column.integer,
    is_hidden: column.integer,
    user_id: column.text,
  }),
  tasks: new Table({
    folder_id: column.text,
    content: column.text,
    sort_order: column.integer,
    is_completed: column.integer, // boolean
    is_today: column.integer,
    is_pinned: column.integer,
    is_deleted: column.integer,
    title_text_style: column.text,
    created_at: column.text,
    updated_at: column.text,
    task_type: column.text,
    group_color: column.text,
    group_id: column.text,
    is_closed: column.integer,
    task_notes: column.text,
    user_id: column.text,
    // item_id, ru, en, uk - можно добавить потом если нужно для UI
  }),
  logs: new Table({
    created_at: column.text,
    action: column.text,
    entity_type: column.text,
    entity_id: column.text,
    details: column.text,
    project_id: column.text,
    user_id: column.text,
  }),
  _ui_folders: new Table({
    project_id: column.text,
    title: column.text,
    sort_order: column.integer,
    created_at: column.text,
    updated_at: column.text,
    is_deleted: column.integer,
    is_hidden: column.integer,
    user_id: column.text,
  }),
  _ui_items: new Table({
    folder_id: column.text,
    content: column.text,
    sort_order: column.integer,
    is_completed: column.integer,
    is_today: column.integer,
    is_pinned: column.integer,
    is_deleted: column.integer,
    title_text_style: column.text,
    created_at: column.text,
    updated_at: column.text,
    task_type: column.text,
    group_color: column.text,
    group_id: column.text,
    is_closed: column.integer,
    task_notes: column.text,
    item_id: column.text,
    ru: column.text,
    en: column.text,
    uk: column.text,
    user_id: column.text,
  }),
  _users: new Table({
     // define columns... placeholder
  }),
  _logs: new Table({
     // define columns... placeholder
  }),
});

export type Database = (typeof AppSchema)['types'];

