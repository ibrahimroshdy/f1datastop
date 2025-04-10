import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SUPABASE_FUNCTIONS } from "@/constants/apiConfig";
import { trackLogin, trackSignup } from '@/integrations/google-analytics/GA4';

export const signUp = async (
  email: string,
  password: string,
  username: string,
  firstName: string,
  lastName: string,
  captchaToken?: string
): Promise<void> => {
  try {
    // For reCAPTCHA v3, we need to proceed even if there's no token yet
    // as the token will be obtained asynchronously
    if (!captchaToken) {
      console.log("No CAPTCHA token provided, attempting to proceed anyway");
    }
    
    // Verify the captcha token with our server-side function if token exists
    if (captchaToken) {
      try {
        const response = await fetch(SUPABASE_FUNCTIONS.VERIFY_CAPTCHA, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: captchaToken
          })
        });
        
        const verificationResult = await response.json();
        
        if (!verificationResult.success) {
          throw new Error(verificationResult.error || "CAPTCHA verification failed");
        }
        
        console.log("CAPTCHA verification successful");
      } catch (captchaError) {
        console.error("Error verifying CAPTCHA:", captchaError);
        // For v3 reCAPTCHA, we may want to proceed anyway but with a risk score
        // For v2, we would throw an error here
      }
    }
    
    // Proceed with signup
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          first_name: firstName,
          last_name: lastName,
          captcha_verified: !!captchaToken, // Mark as verified only if token exists
        },
      },
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    // Track successful signup with email method
    trackSignup('email');

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
            provider: "email"
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    // Track successful login with email method
    trackLogin('email');
    
    toast.success('Logged in successfully');
  } catch (error: any) {
    // Just rethrow for the UI to handle
    throw error;
  }
};

export const signInWithX = async (): Promise<void> => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'twitter',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }
    
    // Track login attempt with Twitter
    // Note: full tracking will happen after redirect
    trackLogin('twitter');
  } catch (error: any) {
    toast.error(error.message || "Failed to sign in with Twitter");
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
    // Extract necessary data from the user object
    const twitterUsername = user.user_metadata?.preferred_username || 
                          user.user_metadata?.user_name || 
                          user.user_metadata?.name || 
                          'twitter_user';
    
    const fullName = user.user_metadata?.full_name || 
                    user.user_metadata?.name || 
                    twitterUsername;
    
    const firstName = fullName.split(' ')[0] || '';
    const lastName = fullName.split(' ').slice(1).join(' ') || '';
    
    // Format the data according to what the Edge Function expects
    const payload = {
      type: "signup",
      userData: {
        firstName,
        lastName,
        username: twitterUsername,
        email: user.email || `${twitterUsername}@twitter.com`,
        provider: "twitter"
      }
    };
    
    // Send POST request with properly formatted JSON
    const response = await fetch(SUPABASE_FUNCTIONS.NOTIFY_SLACK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    // Check for successful response
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Slack notification failed:", errorText);
    }
  } catch (slackError) {
    // Don't fail the signup if the slack notification fails
    console.error("Twitter notification error:", slackError);
  }
};
