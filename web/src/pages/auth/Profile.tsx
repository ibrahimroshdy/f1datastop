import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { trackEvent } from '@/integrations/google-analytics/GA4.tsx';
import useAnalytics from '@/hooks/useAnalytics';
import { useDeveloper } from '@/context/DeveloperContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/context/ThemeContext';
import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardFooter,
  F1CardHeader,
  F1CardTitle,
  PageHeader,
} from '@/components/f1';
import { pageShellNarrow, pageStack } from '@/lib/layout';
import { cn } from '@/lib/utils';
import { F1Skeleton } from '@/components/f1/F1Skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { NotificationToggle } from "@/components/pwa/NotificationToggle";

const Profile = () => {
  const { isGlass } = useTheme();
  const cardVariant = isGlass ? "glass" : "default";
  const glassVariant = isGlass ? "panel" : "default";
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { incrementProfileClickCount } = useDeveloper();
  const analytics = useAnalytics();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    username: profile?.username || '',
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || ''
  });
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // Track profile page view
  useEffect(() => {
    trackEvent('profile_view', {
      user_type: user?.app_metadata?.provider || 'email',
      is_completed: !!user?.user_metadata?.first_name
    });
  }, [user]);

  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) {
        setLoading(false);
        setInitialLoad(false);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch profile data directly from Supabase instead of using updateProfile
        const { data, error } = await (supabase as any)
          .from('profiles')
          .select('username, first_name, last_name')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error("Error fetching profile:", error);
          toast({
            title: "Error fetching profile",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        setFormData({
          username: data?.username || "",
          first_name: data?.first_name || "",
          last_name: data?.last_name || ""
        });
      } catch (error: unknown) {
        console.error("Unexpected error:", error);
        toast({
          title: "Error",
          description: "An unexpected error occurred while fetching your profile.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    };

    fetchProfileData();
  }, [user, toast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setIsUpdating(true);
      
      trackEvent('profile_update', {});

      // Update profile directly in Supabase to fix type issues
      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          username: formData.username,
          first_name: formData.first_name,
          last_name: formData.last_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        console.error("Error updating profile:", error);
        toast({
          title: "Error updating profile",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      await refreshProfile();
    } catch (error: unknown) {
      console.error("Unexpected error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while updating your profile.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Get initials for avatar
  const getInitials = () => {
    if (profile) {
      return `${profile.first_name?.charAt(0) || ''}${profile.last_name?.charAt(0) || ''}`.toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?';
    }
    return user?.email?.charAt(0).toUpperCase() || '?';
  };

  const handleProfileHeaderClick = () => {
    incrementProfileClickCount();
    // Uncomment for debugging: console.log('Profile click count:', profileClickCount + 1);
  };

  if (initialLoad || loading) {
    return (
      <div className={pageShellNarrow}>
        <div className={pageStack}>
          <F1Skeleton variant="text" lines={2} width="12rem" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <F1Skeleton variant="card" className="md:col-span-1" height="16rem" />
            <F1Skeleton variant="card" className="md:col-span-2" height="16rem" />
          </div>
          <F1Skeleton variant="card" height="8rem" />
        </div>
      </div>
    );
  }

  return (
    <div className={pageShellNarrow}>
      <div className={cn(pageStack, "animate-fade-in")}>
        <PageHeader title="Your Profile" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Overview */}
          <div className="md:col-span-1">
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="h-full flex flex-col p-0">
              <F1CardHeader className="flex flex-col items-center" onClick={handleProfileHeaderClick}>
                <Avatar className="w-24 h-24 mb-2 bg-primary text-primary-foreground text-2xl cursor-pointer">
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
                <F1CardTitle className="cursor-pointer justify-center !text-xl">
                  {profile?.first_name} {profile?.last_name}
                </F1CardTitle>
                <F1CardDescription className="text-center">
                  @{profile?.username}
                  <div className="mt-1">{user?.email}</div>
                </F1CardDescription>
              </F1CardHeader>
              <F1CardFooter className="flex justify-center space-x-2 mt-auto border-t-0">
                <Button variant="outline" onClick={() => { void analytics.trackInteraction('profile_sign_out', 'click'); void signOut(); }}>
                  Sign out
                </Button>
              </F1CardFooter>
            </F1Card>
          </div>
          
          {/* Edit Profile Form */}
          <div className="md:col-span-2">
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="h-full flex flex-col p-0">
              <F1CardHeader>
                <F1CardTitle className="!text-xl">Edit Profile</F1CardTitle>
                <F1CardDescription>
                  Update your personal information
                </F1CardDescription>
              </F1CardHeader>
              <F1CardContent className="flex-1">
                <form onSubmit={handleSubmit} className="space-y-4 h-full flex flex-col">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      className="bg-background"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleChange}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleChange}
                        className="bg-background"
                      />
                    </div>
                  </div>
                  <div className="pt-2 mt-auto">
                    <Button 
                      type="submit" 
                      className="bg-primary hover:bg-primary/90"
                      disabled={isUpdating}
                    >
                      {isUpdating ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </F1CardContent>
            </F1Card>
          </div>
        </div>

        <F1Card variant={cardVariant} glassVariant={glassVariant} className="p-0">
          <F1CardHeader>
            <F1CardTitle className="!text-xl">Notifications</F1CardTitle>
            <F1CardDescription>
              Get a push notification before each race weekend.
            </F1CardDescription>
          </F1CardHeader>
          <F1CardContent>
            <NotificationToggle />
          </F1CardContent>
        </F1Card>
      </div>
    </div>
  );
};

export default Profile;
