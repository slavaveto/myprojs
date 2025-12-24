import { useEffect, useState } from 'react';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { useUser } from '@clerk/nextjs';
import { PlanTier } from '@/app/admin/_services/acl';

export interface UserRoleData {
  isSuperAdmin: boolean;
  isOwner: boolean;
  plan: PlanTier;
  subscriptionStatus: string;
}

export function useIsSuperAdmin() {
  const { user, isLoaded } = useUser();
  const { supabase } = useSupabase();
  
  const [roleData, setRoleData] = useState<UserRoleData>({
    isSuperAdmin: false,
    isOwner: false,
    plan: 'free',
    subscriptionStatus: 'inactive'
  });
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setIsLoading(false);
      return;
    }

    async function checkStatus() {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('is_super_admin, is_owner, plan, subscription_status')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (error || !data) {
           // Default values if user not found or error
           setRoleData({ isSuperAdmin: false, isOwner: false, plan: 'free', subscriptionStatus: 'inactive' });
        } else {
           setRoleData({
             isSuperAdmin: data.is_super_admin === true,
             isOwner: data.is_owner === true,
             plan: (data.plan as PlanTier) || 'free',
             subscriptionStatus: data.subscription_status || 'inactive'
           });
        }
      } catch (err) {
         setRoleData({ isSuperAdmin: false, isOwner: false, plan: 'free', subscriptionStatus: 'inactive' });
      } finally {
        setIsLoading(false);
      }
    }

    checkStatus();
  }, [user, isLoaded, supabase]);

  return { 
     isSuperAdmin: roleData.isSuperAdmin, // Для совместимости со старым кодом
     roleData,                            // Полные данные
     isLoading 
  };
}
