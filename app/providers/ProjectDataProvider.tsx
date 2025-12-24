"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('ProjectDataProvider');

interface ProjectData {
   id: string;
   title: string;
   is_active?: boolean;
   user_id: string; // Владелец проекта
   slug?: string;
}

interface ProjectContextType {
   projectData: ProjectData | null;
   isLoading: boolean;
   error: Error | null;
}

const ProjectContext = createContext<ProjectContextType>({
   projectData: null,
   isLoading: true,
   error: null,
});

export function ProjectDataProvider({ 
   subdomain, 
   children 
}: { 
   subdomain: string; 
   children: React.ReactNode 
}) {
   const { supabase } = useSupabase();
   const [projectData, setProjectData] = useState<ProjectData | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<Error | null>(null);

   useEffect(() => {
      let isMounted = true;

      async function fetchProject() {
         // Пропускаем "системные" субдомены
         if (subdomain === 'admin' || subdomain === 'www' || !subdomain) {
             setIsLoading(false);
             return;
         }

         logger.start('Загрузка данных проекта', { subdomain });
         
         try {
            // Внимание: Здесь мы предполагаем, что в таблице rooms есть колонка slug (или используем room_id как слаг)
            // Для boilerplate это нормальное допущение, которое нужно будет адаптировать под реальную БД.
            const { data, error } = await supabase
               .from('rooms') // Или 'projects'
               .select('room_id, room_title, is_active, user_id') // Добавьте slug, если он есть в БД
               // .eq('slug', subdomain) // <-- Идеальный вариант для SaaS
               .eq('room_id', subdomain) // <-- Временный вариант: считаем субдомен ID комнаты, пока нет поля slug
               .maybeSingle();

            if (!isMounted) return;

            if (error) throw error;

            if (data) {
               // Проверка активности
               if (data.is_active === false) {
                  logger.warning('Проект неактивен', { subdomain });
                  throw new Error('Project is inactive');
               }

               setProjectData({
                  id: data.room_id,
                  title: data.room_title,
                  is_active: data.is_active,
                  user_id: data.user_id,
                  slug: subdomain
               });
               logger.success('Данные проекта загружены', data);
            } else {
               logger.warning('Проект не найден в БД', { subdomain });
               throw new Error('Project not found');
            }
         } catch (err: any) {
            if (!isMounted) return;
            logger.error('Ошибка загрузки проекта', err);
            setError(err);
         } finally {
            if (isMounted) {
               setIsLoading(false);
            }
         }
      }

      fetchProject();

      return () => {
         isMounted = false;
      };
   }, [subdomain, supabase]);

   return (
      <ProjectContext.Provider value={{ projectData, isLoading, error }}>
         {children}
      </ProjectContext.Provider>
   );
}

export function useProjectData() {
   return useContext(ProjectContext);
}








