'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase/supabaseClient';
import { useAppLoader } from '@/app/AppLoader';

export default function RootPage() {
   const router = useRouter();
   const { setLoading } = useAppLoader();

   useEffect(() => {
      const redirectToFirstProject = async () => {
         setLoading(true);
         const { data } = await supabase
            .from('projects')
            .select('id')
            .order('sort_order')
            .limit(1)
            .single();

         if (data) {
            router.replace(`/${data.id}`);
            // Don't setLoading(false) here, let the destination page handle it
            // or if navigation takes time, the spinner persists.
         } else {
            setLoading(false);
         }
      };

      redirectToFirstProject();
   }, []);

   return null; // Spinner from layout covers this
}

