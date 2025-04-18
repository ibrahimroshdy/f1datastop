import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { trackEvent } from '@/integrations/google-analytics/GA4';
import useAnalytics from '@/hooks/useAnalytics';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

const Profile = () => {
  const { user, profile, updateProfile, deleteAccount, signOut } = useAuth();
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
      if (!user) return;

      try {
        setLoading(true);
        
        // Fetch profile data directly from Supabase instead of using updateProfile
        const { data, error } = await supabase
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
          username: data.username || "",
          first_name: data.first_name || "",
          last_name: data.last_name || ""
        });
      } catch (error: any) {
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
  }, [user, toast]); // Remove updateProfile from dependencies

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
      const { error } = await supabase
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
    } catch (error: any) {
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

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      
      // Track account deletion event
      analytics.trackInteraction('account_deletion', 'click');
    } catch (error) {
      console.error('Error deleting account:', error);
    }
  };

  if (initialLoad || loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-4xl py-6 space-y-6">
        <h1 className="text-3xl font-bold">Your Profile</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Overview */}
          <div className="md:col-span-1">
            <Card className="bg-card border-border h-full flex flex-col">
              <CardHeader className="flex flex-col items-center">
                <Avatar className="w-24 h-24 mb-2 bg-primary text-primary-foreground text-2xl">
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
                <CardTitle>{profile?.first_name} {profile?.last_name}</CardTitle>
                <CardDescription className="text-center">
                  @{profile?.username}
                  <div className="mt-1">{user?.email}</div>
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-center space-x-2 mt-auto">
                <Button variant="outline" onClick={signOut}>Sign Out</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Delete Account</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-background border border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account
                        and remove your data from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteAccount}
                      >
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          </div>
          
          {/* Edit Profile Form */}
          <div className="md:col-span-2">
            <Card className="bg-card border-border h-full flex flex-col">
              <CardHeader>
                <CardTitle>Edit Profile</CardTitle>
                <CardDescription>
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <form onSubmit={handleSubmit} className="space-y-4 h-full flex flex-col">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      className="bg-input"
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
                        className="bg-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleChange}
                        className="bg-input"
                      />
                    </div>
                  </div>
                  <div className="pt-2 mt-auto">
                    <Button 
                      type="submit" 
                      className="bg-f1-red hover:bg-red-700"
                      disabled={isUpdating}
                    >
                      {isUpdating ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Profile;
