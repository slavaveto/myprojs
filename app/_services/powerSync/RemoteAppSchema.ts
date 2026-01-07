import { Schema, Table, column } from '@powersync/web';

export const RemoteAppSchema = new Schema({
  '-ui_folders': new Table({
    project_id: column.text,
    title: column.text,
    sort_order: column.integer,
    created_at: column.text,
    updated_at: column.text,
    is_deleted: column.integer,
    is_hidden: column.integer
  }),
  '-ui_items': new Table({
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
  }),
});

