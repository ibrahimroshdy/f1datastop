
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

interface AuthContextProps {
  user: User | null;
  session: Session | null;
  profile: any | null; // Profile data from our profiles table
  isLoading: boolean;
  signUp: (email: string, password: string, username: string, firstName: string, lastName: string) => Promise<void>;
  signIn: (emailOrUsername: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateProfile: (data: Partial<{ username: string; first_name: string; last_name: string }>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          // Use setTimeout to avoid potential deadlocks with Supabase client
          setTimeout(() => {
            fetchProfile(currentSession.user.id);
          }, 0);
        } else {
          setProfile(null);
        }

        // Handle specific auth events if needed
        if (event === 'SIGNED_OUT') {
          setProfile(null);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        fetchProfile(currentSession.user.id);
      }
      
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    username: string,
    firstName: string,
    lastName: string
  ): Promise<void> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (error) {
        toast.error(error.message);
        throw error;
      }

      // Notify Slack about the new signup
      try {
        console.log("Sending signup notification to Slack...");
        const notifyResult = await supabase.functions.invoke("notify-slack", {
          body: {
            type: "signup",
            userData: {
              email,
              username,
              firstName,
              lastName,
            },
          },
        });
        
        console.log("Slack notification result:", notifyResult);
        
        if (notifyResult.error) {
          console.error("Error in Slack notification response:", notifyResult.error);
        } else {
          console.log("Slack notification sent successfully");
        }
      } catch (slackError) {
        // Don't fail the signup if the slack notification fails, just log it
        console.error("Failed to send Slack notification:", slackError);
      }

      toast.success("Registration successful! Please check your email to confirm your account.");
    } catch (error: any) {
      console.error("Error during sign up:", error);
      throw error;
    }
  };

  const signIn = async (emailOrUsername: string, password: string): Promise<void> => {
    try {
      // Check if input is an email (contains @) or username
      const isEmail = emailOrUsername.includes('@');
      
      if (isEmail) {
        // Direct login with email
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailOrUsername,
          password,
        });

        if (error) {
          toast.error(error.message);
          throw error;
        }

        toast.success("Login successful!");
        navigate("/");
      } else {
        // Find user by username first
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', emailOrUsername)
          .maybeSingle();

        if (profileError || !profileData) {
          toast.error("Username not found");
          throw new Error("Username not found");
        }

        // Get user email from auth.users using the user ID from profiles
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
          profileData.id
        );

        if (userError || !userData?.user?.email) {
          toast.error("Failed to find user");
          throw new Error("Failed to find user");
        }

        // Login with the retrieved email
        const { data, error } = await supabase.auth.signInWithPassword({
          email: userData.user.email,
          password,
        });

        if (error) {
          toast.error(error.message);
          throw error;
        }

        toast.success("Login successful!");
        navigate("/");
      }
    } catch (error: any) {
      console.error("Error during sign in:", error);
      throw error;
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth/reset-password',
      });

      if (error) {
        toast.error(error.message);
        throw error;
      }

      toast.success("Password reset email sent. Please check your inbox.");
    } catch (error: any) {
      console.error("Error during password reset:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(error.message);
        throw error;
      }
      
      toast.success("Signed out successfully");
      navigate("/auth/login");
    } catch (error: any) {
      console.error("Error during sign out:", error);
      throw error;
    }
  };

  const deleteAccount = async () => {
    try {
      // First sign out the user
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Note: For security reasons, users typically need to authenticate specifically
      // to delete their account. Supabase doesn't provide a direct method for this.
      // You would typically use a Supabase Function for this, but for now we'll
      // inform the user they need to contact support or visit their account settings.
      
      toast.success("Your account has been scheduled for deletion. Please check your email for confirmation.");
      navigate("/auth/login");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account: " + error.message);
      throw error;
    }
  };

  const updateProfile = async (data: Partial<{ username: string; first_name: string; last_name: string }>): Promise<void> => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user.id);

      if (error) {
        toast.error(error.message);
        throw error;
      }

      // Refresh profile data
      fetchProfile(user.id);
      toast.success("Profile updated successfully");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      throw error;
    }
  };

  const contextValue: AuthContextProps = {
    user,
    session,
    profile,
    isLoading,
    signUp,
    signIn,
    signOut,
    deleteAccount,
    updateProfile,
    resetPassword,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
