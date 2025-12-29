import { supabase } from '@/utils/supabase/supabaseClient';
import { DB_TABLES } from '@/utils/supabase/db_tables';

export interface DocFlow {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  created_at: string;
}

export interface DocStep {
  id: string;
  flow_id: string;
  ref_id: string;
  title: string;
  description?: string;
  step_order: number;
  role: 'trigger' | 'action';
  snippet?: string; // For input/transfer
  code_snippet?: string; // From DB column
}

export const docsService = {
  async getFlows(projectId: string) {
    const { data, error } = await supabase
      .from(DB_TABLES.DOCS_FLOWS)
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching flows:', error);
      throw error;
    }

    return data as DocFlow[];
  },

  async createFlow(projectId: string, title: string) {
    const { data, error } = await supabase
      .from(DB_TABLES.DOCS_FLOWS)
      .insert({ project_id: projectId, title })
      .select()
      .single();

    if (error) {
        console.error('Supabase Error creating flow:', error);
        throw error;
    }
    return data as DocFlow;
  },

  async getSteps(flowId: string) {
    const { data, error } = await supabase
      .from(DB_TABLES.DOCS_STEPS)
      .select('*')
      .eq('flow_id', flowId)
      .order('step_order', { ascending: true });

    if (error) {
      console.error('Error fetching steps:', error);
      throw error;
    }

    return data as DocStep[];
  },

  async getAllProjectSteps(projectId: string) {
    // Fetch all steps for all flows in the project
    // Using inner join to filter by project_id
    const { data, error } = await supabase
      .from(DB_TABLES.DOCS_STEPS)
      .select('*, docs_flows!inner(project_id)')
      .eq('docs_flows.project_id', projectId)
      .order('step_order', { ascending: true });

    if (error) {
      console.error('Error fetching all project steps:', error);
      throw error;
    }

    return data as DocStep[];
  },

  async addStep(step: Omit<DocStep, 'id'>) {
    const { snippet, ...rest } = step;
    
    // Map snippet to code_snippet column
    const dbPayload = {
        ...rest,
        code_snippet: snippet
    };

    const { data, error } = await supabase
      .from(DB_TABLES.DOCS_STEPS)
      .insert(dbPayload)
      .select()
      .single();

    if (error) {
        console.error('Error adding step:', error);
        throw error;
    }
    return data as DocStep;
  },

  async deleteStep(stepId: string) {
      const { error } = await supabase
          .from(DB_TABLES.DOCS_STEPS)
          .delete()
          .eq('id', stepId);
      
      if (error) throw error;
  }
};
