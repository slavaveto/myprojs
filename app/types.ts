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
   created_at: string;
   updated_at: string;
   isNew?: boolean;
   _tempId?: string;
}
