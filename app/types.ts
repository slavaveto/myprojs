export interface Project {
   id: string;
   title: string;
   proj_color: string;
   sort_order: number;
   created_at: string;
   updated_at: string;
    local_path?: string; // Name of the folder in ~/Projs/
   proj_type?: string; // 'ui' for satellite projects
   parent_proj_id?: string; // ID of the parent project for satellites
   is_deleted?: boolean; // Added for Soft Delete
   show_docs_btn?: boolean; // Toggle for Docs button visibility
   is_highlighted?: boolean; // Special styling for important projects
}

export interface Folder {
   id: string;
   project_id: string;
   title: string;
   sort_order: number;
   created_at: string;
   updated_at: string;
   is_deleted?: boolean; // Added for Soft Delete
}

export interface Task {
   id: string;
   folder_id: string;
   content: string;
   sort_order: number;
   is_completed: boolean;
   is_today?: boolean;
   is_pinned?: boolean;
   is_deleted?: boolean;
   title_text_style?: 'bold' | 'red' | 'red-bold' | null;
   created_at: string;
   updated_at: string;
   task_type: 'task' | 'gap' | 'group' | 'note'; // New field
   group_color?: string;
   group_id?: string | null; // Parent group ID
   is_closed?: boolean; // Collapsed state for groups
   isNew?: boolean;
   isDraft?: boolean;
   _tempId?: string;
   _isSaving?: boolean; // Флаг активного сохранения
   task_notes?: string; // Rich Text notes
}
