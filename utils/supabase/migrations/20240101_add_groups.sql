
-- 1. Add new columns
ALTER TABLE public.tasks 
ADD COLUMN group_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
ADD COLUMN is_closed BOOLEAN DEFAULT false;

-- 2. Create index for faster lookups
CREATE INDEX idx_tasks_group_id ON public.tasks(group_id);

-- 3. Migration logic to link existing tasks based on visual order
DO $$
DECLARE
    r RECORD;
    current_group_id UUID := NULL;
BEGIN
    -- Iterate through tasks ordered by folder and sort_order (Project link is via Folder, so order by Folder is enough)
    -- We assume tasks are unique per folder.
    FOR r IN 
        SELECT id, folder_id, task_type, sort_order 
        FROM public.tasks 
        WHERE is_deleted = false
        ORDER BY folder_id, sort_order ASC
    LOOP
        -- If we hit a group header, set it as current parent
        IF r.task_type = 'group' THEN
            current_group_id := r.id;
        
        -- If we hit a gap, reset parent (gap breaks the group)
        ELSIF r.task_type = 'gap' THEN
            current_group_id := NULL;
            
        -- If standard task and we have an active group, link it
        ELSIF current_group_id IS NOT NULL THEN
            UPDATE public.tasks 
            SET group_id = current_group_id 
            WHERE id = r.id;
        END IF;
    END LOOP;
END $$;

