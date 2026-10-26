import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export type Placement = {
  section_id: string;
  academic_level: 'junior_high' | 'senior_high' | 'college';
  grade_level: number | null;
  strand_id: string | null;
  course_id: string | null;
  year_level: number | null;
};

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher';
  // Students only, chosen once at registration
  placement?: Placement | null;
};

type PendingProfile = {
  userId: string;
  full_name: string;
  role: 'student' | 'teacher';
};

// In-memory pending profile. Survives a signup → email confirm → sign-in flow
// within a single app session. We deliberately do NOT use expo-secure-store
// here: its native binary is not bundled into Expo Go, so importing it crashes
// the app on startup (Error: Cannot find native module 'ExpoSecureStore').
let pendingProfile: PendingProfile | null = null;

function savePendingProfile(p: PendingProfile) {
  pendingProfile = p;
}

function loadPendingProfile(): PendingProfile | null {
  return pendingProfile;
}

function clearPendingProfile() {
  pendingProfile = null;
}

/**
 * Applies a role/name chosen at signup to the profile row the first time that
 * user actually signs in. This covers the email-confirmation flow (where no
 * session exists right after signup, so the post-signup UPDATE can't run yet).
 * It ONLY ever applies to the exact user id that was created at signup.
 */
async function applyPendingProfile(userId: string) {
  const pending = loadPendingProfile();
  if (!pending) return;
  if (pending.userId !== userId) {
    clearPendingProfile(); // never apply to a different account
    return;
  }
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: pending.full_name, role: pending.role })
    .eq('id', userId);
  if (!error) {
    clearPendingProfile();
  }
}

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = false;
let listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach((l) => l());
}

export function setAuth(session: Session | null) {
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;
  notify();
}

export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
  };
}

export async function signUp(email: string, password: string, profile?: SignUpProfile) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: profile?.full_name ?? '',
        role: profile?.role ?? 'student',
        // The database saves these for students and checks they match each other.
        ...(profile?.role === 'student' && profile?.placement
          ? {
              academic_level: profile.placement.academic_level,
              section_id: profile.placement.section_id,
              ...(profile.placement.grade_level != null ? { grade_level: profile.placement.grade_level } : {}),
              ...(profile.placement.strand_id ? { strand_id: profile.placement.strand_id } : {}),
              ...(profile.placement.course_id ? { course_id: profile.placement.course_id } : {}),
              ...(profile.placement.year_level != null ? { year_level: profile.placement.year_level } : {}),
            }
          : {}),
      },
    },
  });

  // Safety net: keep the chosen role in memory so it survives an email
  // confirmation step and gets applied on the next successful sign-in.
  if (!error && profile && data.user?.id) {
    savePendingProfile({
      userId: data.user.id,
      full_name: profile.full_name,
      role: profile.role,
    });
  }

  // The Phase 3 trigger reads full_name/role from the signup metadata and
  // creates the profile row with the RIGHT role — even when email confirmation
  // is ON (no immediate session). This UPDATE is a belt-and-suspenders pass for
  // the no-confirmation path (it double-sets the same values, which is harmless).
  let profileError: string | null = null;
  if (!error && data.session) {
    if (profile) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: profile.full_name, role: profile.role })
        .eq('id', data.session.user.id);
      profileError = updateError?.message ?? null;
      if (!updateError) clearPendingProfile();
    }
    setAuth(data.session);
  }
  return { data, error, profileError };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error && data.session) {
    // If the user signed up with a role while email confirmation was ON, the
    // role was saved in memory at signup — apply it now that they've logged in.
    await applyPendingProfile(data.session.user.id);
    setAuth(data.session);
  }
  return { data, error };
}

export async function signOut() {
  setAuth(null);
  supabase.auth.signOut().catch(() => {});
  return { error: null };
}
