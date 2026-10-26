import { useEffect, useState } from 'react';

import { useAuth } from './auth';
import { supabase } from './supabase';

export type Role = 'student' | 'teacher' | 'admin';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: { full_name?: string; role?: Role }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  return { error: error?.message ?? null };
}

/** Returns the logged-in user's role (null while loading / logged out). */
export function useMyRole(): Role | null {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    if (!userId) {
      setRole(null);
      return;
    }
    let active = true;
    getProfile(userId).then((profile) => {
      if (active) setRole(profile?.role ?? 'student');
    });
    return () => {
      active = false;
    };
  }, [userId]);

  return role;
}


/** The logged-in user's personal QR token. Read through a server function so
 *  nobody can read anybody else's token. */
export async function getMyQrToken(_userId?: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_my_qr_token');
  if (error || !data) return null;
  return data as string;
}
