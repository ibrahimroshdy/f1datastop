import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
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
import { Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react';
import f1Logo from '@/assets/f1-logo.svg';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { resetPassword } = useAuth();
  const location = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordMismatchError, setPasswordMismatchError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const { isGlass } = useTheme();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenFromUrl = params.get('token');
    setToken(tokenFromUrl);
  }, [location.search]);

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
      setPasswordMismatchError("Passwords do not match");
      return;
    }
    setPasswordMismatchError(null);
    setIsLoading(true);
  
    try {
      // Assuming you have a function in your AuthContext to handle the actual password reset with the token
      // and new password.  Replace 'confirmPasswordReset' with the actual function name.
      // await confirmPasswordReset(token, newPassword);
      setResetSuccess(true);
    } catch (error) {
      console.error('Password reset error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link 
            to="/" 
            className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Dashboard
          </Link>
        </div>

        <div className="mb-6 flex justify-center">
          <img src={f1Logo} alt="F1 DataStop" className="w-20 h-20" />
        </div>
        
        <F1Card
          variant={isGlass ? "glass" : "default"}
          glassVariant={isGlass ? "panel" : "default"}
          className={cn("w-full p-0", isGlass && "border-white/10")}
        >
          <F1CardHeader className="space-y-1 text-center">
            <F1CardTitle className="!text-2xl justify-center">
              {token ? "Reset Password" : "Request Password Reset"}
            </F1CardTitle>
            <F1CardDescription className="text-muted-foreground">
              {token
                ? "Enter your new password"
                : isEmailSent
                  ? "Check your email for a password reset link."
                  : "Enter your email to receive a password reset link"}
            </F1CardDescription>
          </F1CardHeader>
          <F1CardContent>
            {!token ? (
              isEmailSent ? (
                <div className="text-center text-muted-foreground">
                  <CheckCircle className="mx-auto h-6 w-6 text-green-500 mb-2" />
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
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </form>
              )
            ) : resetSuccess ? (
              <div className="text-center text-muted-foreground">
                <CheckCircle className="mx-auto h-6 w-6 text-green-500 mb-2" />
                <p>Your password has been successfully reset.</p>
                <Link to="/auth/login" className="text-primary hover:underline">
                  Return to Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                  <Input
                    id="confirmNewPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>
                {passwordMismatchError && (
                  <p className="text-sm text-destructive">{passwordMismatchError}</p>
                )}
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            )}
          </F1CardContent>
          <F1CardFooter className="flex justify-center border-t-0 pt-2">
            <Link to="/auth/login" className="text-sm text-muted-foreground hover:text-primary hover:underline">
              Return to Login
            </Link>
          </F1CardFooter>
        </F1Card>
      </div>
    </div>
  );
};

export default ResetPassword;
