import type { ProfileUser } from '../types';
import { isSupabaseConfigured, supabase } from './supabaseClient';

const mapUser = (user: { id: string; email?: string } | null | undefined): ProfileUser | null =>
  user ? { id: user.id, email: user.email } : null;

export class AuthService {
  get configured() {
    return isSupabaseConfigured;
  }

  async currentUser(): Promise<ProfileUser | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return mapUser(data.user);
  }

  onAuthChange(callback: (user: ProfileUser | null) => void) {
    if (!supabase) return () => undefined;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(mapUser(session?.user));
    });

    return () => data.subscription.unsubscribe();
  }

  async sendMagicLink(email: string) {
    if (!supabase) throw new Error('Supabase is not configured');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) throw error;
  }

  async signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
}

export const authService = new AuthService();
