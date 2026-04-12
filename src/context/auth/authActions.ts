import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackLogin, trackSignup } from '@/integrations/google-analytics/GA4.tsx';
import { identifyUser, trackEvent as trackClarityEvent } from '@/integrations/clarity/clarityHelpers';

// Add tracking for user ID
const setUserIdForAnalytics = (userId: string, userData?: { email?: string, name?: string, role?: string }) => {
  // Set user ID in localStorage for GA4 to pick up
  try {
    localStorage.setItem('userId', userId);
  } catch (e) {
    console.error('Error setting user ID in localStorage', e);
  }
  
  // Identify the user in Clarity
  if (userData) {
    identifyUser(userId, {
      email: userData.email,
      name: userData.name,
      role: userData.role
    });
  } else {
    identifyUser(userId);
  }
  
  // Track user identification event in GA4
  trackEvent('user_identified', {
    user_id: userId,
    method: 'auth_state_change',
    user_properties: {
      authenticated: true
    }
  });
};

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
        const { data: verificationResult, error: captchaFnError } = await supabase.functions.invoke(
          'captcha-verify',
          { body: { token: captchaToken } }
        );
        if (captchaFnError) {
          throw captchaFnError;
        }
        if (
          verificationResult &&
          typeof verificationResult === 'object' &&
          'success' in verificationResult &&
          !(verificationResult as { success: boolean }).success
        ) {
          throw new Error((verificationResult as { error?: string }).error || "CAPTCHA verification failed");
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

    // Set user ID for analytics if available
    if (data.user?.id) {
      const fullName = `${firstName} ${lastName}`.trim();
      setUserIdForAnalytics(data.user.id, {
        email: email,
        name: fullName,
        role: 'user'
      });
      
      // Track signup event in Clarity
      trackClarityEvent('user_signup');
    }

    // Track successful signup with email method
    trackSignup('email');

    // Notify Slack about the new signup
    try {
      const { data: notifyResult, error: notifyError } = await supabase.functions.invoke(
        'notify-slack',
        {
          body: {
            type: "signup",
            userData: {
              email,
              username,
              firstName,
              lastName,
              provider: "email"
            },
          },
        }
      );
      if (notifyError) {
        console.error("Error in Slack notification:", notifyError);
      } else if (notifyResult && typeof notifyResult === 'object' && 'error' in notifyResult) {
        console.error("Error in Slack notification response:", notifyResult);
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

    // Set user ID for analytics tracking
    if (data.user?.id) {
      setUserIdForAnalytics(data.user.id, {
        email: data.user.email
      });
      
      // Track login event in Clarity
      trackClarityEvent('user_login');
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

// Handle auth state change to ensure analytics tracking is set correctly
export const handleAuthStateChange = async (session: any) => {
  if (session?.user?.id) {
    // Get user profile data if available
    try {
      const { data } = await supabase
        .from('profiles')
        .select('username, first_name, last_name')
        .eq('id', session.user.id)
        .single();
      
      if (data) {
        const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.username;
        
        // Set user ID for analytics when session is established or changed
        setUserIdForAnalytics(session.user.id, {
          email: session.user.email,
          name: fullName,
          role: 'user'
        });
        
        return;
      }
    } catch (error) {
      console.error('Error fetching user profile for analytics:', error);
    }
    
    // Fallback if profile fetch fails
    setUserIdForAnalytics(session.user.id, {
      email: session.user.email
    });
  }
};

// Ensure user ID is cleared on signout
export const signOut = async () => {
  try {
    // Track signout event
    trackEvent('user_signed_out', {
      timestamp: new Date().toISOString()
    });
    
    // Track in Clarity
    trackClarityEvent('user_logout');
    
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      throw error;
    }
    
    // Clear user ID from analytics
    try {
      localStorage.removeItem('userId');
    } catch (e) {
      console.error('Error clearing user ID from localStorage', e);
    }
    
    toast.success("Signed out successfully");
  } catch (error: any) {
    console.error("Error during sign out:", error);
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
    
    const { data, error } = await supabase.functions.invoke('notify-slack', { body: payload });
    if (error) {
      console.error("Slack notification failed:", error);
    } else if (data && typeof data === 'object' && 'error' in data) {
      console.error("Slack notification response error:", data);
    }
  } catch (slackError) {
    // Don't fail the signup if the slack notification fails
    console.error("Twitter notification error:", slackError);
  }
};

// Add new tracking event helper
export const trackEvent = (eventName: string, eventParams?: Record<string, any>) => {
  // Re-export for convenience
          import('@/integrations/google-analytics/GA4.tsx').then(module => {
    module.trackEvent(eventName, eventParams);
  });
};
