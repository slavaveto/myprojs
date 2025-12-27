export interface Project {
   id: string;
   title: string;
   color: string;
   sort_order: number;
   created_at: string;
   updated_at: string;
}

export interface Folder {
   id: string;
   project_id: string;
   title: string;
   sort_order: number;
   created_at: string;
   updated_at: string;
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
   created_at: string;
   updated_at: string;
   task_type: 'task' | 'gap' | 'group'; // New field
   group_color?: string;
   isNew?: boolean;
   isDraft?: boolean;
   _tempId?: string;
   _isSaving?: boolean; // Флаг активного сохранения
}
