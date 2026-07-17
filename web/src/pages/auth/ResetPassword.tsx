import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardFooter,
  F1CardHeader,
  F1CardTitle,
} from '@/components/f1';
import { CheckCircle } from 'lucide-react';
import f1Logo from '@/assets/f1-logo.svg';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AuthShell from '@/components/auth/AuthShell';
import { PasswordChecklist, isPasswordValid } from '@/components/auth/PasswordChecklist';

const hashHasRecoveryType = () => {
  const raw = window.location.hash?.replace(/^#/, '') ?? '';
  const params = new URLSearchParams(raw);
  return params.get('type') === 'recovery';
};

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { resetPassword } = useAuth();
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordMismatchError, setPasswordMismatchError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (hashHasRecoveryType()) {
      setRecoveryMode(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && hashHasRecoveryType()) {
        setRecoveryMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await resetPassword(email);
      setIsEmailSent(true);
    } catch (error) {
      console.error('Password reset request error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setPasswordMismatchError('Passwords do not match');
      return;
    }
    setPasswordMismatchError(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Password updated. Sign in with your new password.');
      await supabase.auth.signOut();
      setResetSuccess(true);
    } catch (error) {
      console.error('Password reset error:', error);
      toast.error('Could not update password. Try requesting a new reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
        <div className="mb-6 flex justify-center">
          <img src={f1Logo} alt="F1 DataStop" className="w-20 h-20" />
        </div>

        <F1Card variant="default" className="w-full p-0">
          <F1CardHeader className="space-y-1 text-center">
            <F1CardTitle className="!text-2xl justify-center">
              {recoveryMode ? 'Set new password' : 'Request password reset'}
            </F1CardTitle>
            <F1CardDescription className="text-muted-foreground">
              {recoveryMode
                ? 'Choose a strong password for your account.'
                : isEmailSent
                  ? 'Check your email for a password reset link.'
                  : 'Enter your email to receive a password reset link.'}
            </F1CardDescription>
          </F1CardHeader>
          <F1CardContent>
            {!recoveryMode ? (
              isEmailSent ? (
                <div className="text-center text-muted-foreground">
                  <CheckCircle className="mx-auto h-6 w-6 text-gain mb-2" />
                  <p>Password reset link has been sent to your email.</p>
                </div>
              ) : (
                <form onSubmit={handleRequestReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-background"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Sending...' : 'Send reset link'}
                  </Button>
                </form>
              )
            ) : resetSuccess ? (
              <div className="text-center text-muted-foreground">
                <CheckCircle className="mx-auto h-6 w-6 text-gain mb-2" />
                <p>Your password has been updated.</p>
                <Link to="/auth/login" className="text-primary hover:underline">
                  Return to login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      className="bg-background pr-10"
                    />
                  </div>
                  {newPassword.length > 0 && (
                    <PasswordChecklist password={newPassword} className="pt-1" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword">Confirm new password</Label>
                  <Input
                    id="confirmNewPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="bg-background"
                  />
                </div>
                {passwordMismatchError && (
                  <p className="text-sm text-destructive">{passwordMismatchError}</p>
                )}
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={isLoading || !isPasswordValid(newPassword)}
                >
                  {isLoading ? 'Updating...' : 'Update password'}
                </Button>
              </form>
            )}
          </F1CardContent>
          <F1CardFooter className="flex justify-center border-t-0 pt-2">
            <Link
              to="/auth/login"
              className="text-sm text-muted-foreground hover:text-primary hover:underline"
            >
              Return to login
            </Link>
          </F1CardFooter>
        </F1Card>
    </AuthShell>
  );
};

export default ResetPassword;
