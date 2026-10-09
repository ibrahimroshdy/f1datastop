import { useState } from 'react';
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
import { Eye, EyeOff, Mail, Twitter } from 'lucide-react';
import f1Logo from '@/assets/f1-logo.svg';
import { cn } from '@/lib/utils';
import AuthShell from '@/components/auth/AuthShell';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { signIn, resetPassword, signInWithX } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await signIn(email, password);
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await resetPassword(forgotPasswordEmail);
      setShowForgotPassword(false);
    } catch (error) {
      console.error('Password reset error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
    <AuthShell>
        <F1Card variant="default" size="default" className="w-full p-0">
          <F1CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <img src={f1Logo} alt="F1 DataStop" className="w-16 h-16" />
            </div>
            <F1CardTitle className="justify-center">
              {showForgotPassword ? "Reset Password" : "Sign In"}
            </F1CardTitle>
            <F1CardDescription className="text-muted-foreground">
              {showForgotPassword 
                ? "Enter your email address to receive a password reset link"
                : "Enter your email and password to access your account"
              }
            </F1CardDescription>
          </F1CardHeader>
          <F1CardContent>
            {showForgotPassword ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>
                <div className="flex flex-col space-y-2">
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </Button>
                  <Button 
                    type="button"
                    variant="ghost"
                    onClick={() => setShowForgotPassword(false)}
                    className="text-muted-foreground"
                  >
                    Back to Login
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-10 bg-background"
                      />
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Button 
                        type="button"
                        variant="link" 
                        className="text-sm text-primary p-0 h-auto"
                        onClick={() => setShowForgotPassword(true)}
                      >
                        Forgot Password?
                      </Button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pr-10 bg-background"
                      />
                      <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>

                {/* X/Twitter Login Button */}
                <div className="relative flex items-center justify-center mt-4">
                  <div className="absolute border-t border-border w-full"></div>
                  <span className={cn(
                    "relative px-2 text-xs text-muted-foreground",
                    "bg-background"
                  )}>OR</span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-4 flex items-center justify-center"
                  onClick={() => signInWithX()}
                  disabled={isLoading}
                >
                  <Twitter className="mr-2 h-4 w-4" />
                  Sign in with X
                </Button>
              </>
            )}
          </F1CardContent>
          <F1CardFooter className="flex justify-center border-t-0 pt-2">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/auth/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </F1CardFooter>
        </F1Card>
    </AuthShell>
  );
};

export default Login;
