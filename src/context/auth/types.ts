
import { User, Session } from "@supabase/supabase-js";

export interface AuthContextProps {
  user: User | null;
  session: Session | null;
  profile: any | null; // Profile data from our profiles table
  isLoading: boolean;
  signUp: (email: string, password: string, username: string, firstName: string, lastName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithTwitter: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateProfile: (data: Partial<{ username: string; first_name: string; last_name: string }>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}
