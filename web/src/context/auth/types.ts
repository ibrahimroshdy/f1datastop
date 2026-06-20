import { User, Session } from "@supabase/supabase-js";

export interface AuthContextProps {
  user: User | null;
  session: Session | null;
  profile: any | null; // Profile data from our profiles table
  isLoading: boolean;
  /** Reload `profiles` row for the signed-in user (e.g. after profile save). */
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, username: string, firstName: string, lastName: string, captchaToken?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithX: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<{ username: string; first_name: string; last_name: string }>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}
