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
import { Eye, EyeOff, ArrowLeft, Mail, Twitter, LifeBuoy } from 'lucide-react';
import f1Logo from '@/assets/f1-logo.svg';
import { useTheme } from '@/context/ThemeContext';
import BuyMeCoffeeWidget from '@/components/common/BuyMeCoffeeWidget';
import { cn } from '@/lib/utils';
import { pageShellNarrow } from '@/lib/layout';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { signIn, resetPassword, signInWithX } = useAuth();
  const { theme } = useTheme();

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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <BuyMeCoffeeWidget size="large" position="fixed" />
      
      <div className={cn(pageShellNarrow, "w-full")}>
        <div className="mb-6">
          <Link 
            to="/" 
            className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Dashboard
          </Link>
        </div>
        
        {/* Product Hunt badge - moved to top */}
        <div className="mb-6 flex justify-center">
          <a 
            href="https://www.producthunt.com/posts/f1-datastop?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-f1&#0045;datastop" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <img 
              src={`https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=950747&theme=${theme}&t=1744238501973`}
              alt="F1 DataStop - Live formula 1 news and race data | Product Hunt" 
              style={{ width: "200px", height: "43px" }} 
              width="200" 
              height="43" 
            />
          </a>
        </div>
        
        <F1Card variant="default" className="w-full p-0">
          <F1CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <img src={f1Logo} alt="F1 DataStop" className="w-16 h-16" />
            </div>
            <F1CardTitle className="!text-2xl justify-center">
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

        {/* Support + community footer */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <a href="mailto:admin@f1datastop.com" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
            <LifeBuoy className="h-3.5 w-3.5" /> Support
          </a>
          <span aria-hidden>·</span>
          <a href="https://www.producthunt.com/posts/f1-datastop" target="_blank" rel="noopener noreferrer"
            className="transition-colors hover:text-foreground">
            Product Hunt
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
