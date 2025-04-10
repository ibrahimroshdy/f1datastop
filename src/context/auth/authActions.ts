import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SUPABASE_FUNCTIONS } from "@/constants/apiConfig";

export const signUp = async (
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
      // Use a direct POST request to the Edge Function URL instead of invoke
      const response = await fetch(SUPABASE_FUNCTIONS.NOTIFY_SLACK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.auth.getSession().then(res => res.data.session?.access_token || '')}`
        },
        body: JSON.stringify({
          type: "signup",
          userData: {
            email,
            username,
            firstName,
            lastName,
          },
        }),
      });
      
      const notifyResult = await response.json();
      
      if (!response.ok) {
        console.error("Error in Slack notification direct response:", notifyResult);
      }
    } catch (slackError) {
      // Don't fail the signup if the slack notification fails, just log it
      console.error("Failed to send Slack notification:", slackError);
      console.error("Error details:", slackError);
    }

    toast.success("Registration successful! Please check your email to confirm your account.");
  } catch (error: any) {
    console.error("Error during sign up:", error);
    throw error;
  }
};

export const signIn = async (email: string, password: string): Promise<void> => {
  try {
    // Direct login with email
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    toast.success("Login successful!");
  } catch (error: any) {
    console.error("Error during sign in:", error);
    throw error;
  }
};

export const signInWithX = async (): Promise<void> => {
  try {
    // Using OAuth 1.0a for X/Twitter authentication
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'twitter',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: false, // Ensure browser redirection happens
      },
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    // The user will be redirected to Twitter for authentication
    // No success message needed here as the page will redirect
    
    // Note: We can't notify Slack here because the user hasn't authenticated yet
    // The notification will be sent from the AuthCallback component
  } catch (error: any) {
    console.error("Error during X/Twitter sign in:", error);
    toast.error("Failed to connect with X/Twitter");
    throw error;
  }
};

export const resetPassword = async (email: string): Promise<void> => {
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

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      throw error;
    }
    
    toast.success("Signed out successfully");
  } catch (error: any) {
    console.error("Error during sign out:", error);
    throw error;
  }
};

export const deleteAccount = async () => {
  try {
    // First sign out the user
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    toast.success("Your account has been scheduled for deletion. Please check your email for confirmation.");
  } catch (error: any) {
    console.error("Error deleting account:", error);
    toast.error("Failed to delete account: " + error.message);
    throw error;
  }
};

export const updateProfile = async (
  userId: string, 
  data: Partial<{ username: string; first_name: string; last_name: string }>,
  fetchProfile: (userId: string) => Promise<void>
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', userId);

    if (error) {
      toast.error(error.message);
      throw error;
    }

    // Refresh profile data
    fetchProfile(userId);
    toast.success("Profile updated successfully");
  } catch (error: any) {
    console.error("Error updating profile:", error);
    throw error;
  }
};

// New function to notify Slack about Twitter sign-ins
export const notifySlackAboutTwitterSignin = async (user: any): Promise<void> => {
  try {
    // Format the data according to what the Edge Function expects
    const response = await fetch(SUPABASE_FUNCTIONS.NOTIFY_SLACK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: "signup",
        userData: {
          // Pass the entire user object with metadata
          ...user,
          // These fields are expected by your Edge Function
          email: user.email || `${user.user_metadata?.preferred_username || 'twitter_user'}@twitter.com`,
          username: user.user_metadata?.preferred_username || user.user_metadata?.user_name,
          provider: "twitter"
        }
      })
    });
    
    // No need to log the results
    await response.json();
  } catch (slackError) {
    // Don't fail the signup if the slack notification fails
  }
};
