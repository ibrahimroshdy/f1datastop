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
import { Eye, EyeOff, Twitter } from 'lucide-react';
import ReCaptcha from '@/components/auth/ReCaptcha';
import { isRecaptchaEnabled } from '@/config/integrations';
import f1Logo from '@/assets/f1-logo.svg';
import { cn } from '@/lib/utils';
import AuthShell from '@/components/auth/AuthShell';
import { PasswordChecklist, isPasswordValid } from '@/components/auth/PasswordChecklist';

const Signup = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { signUp, signInWithX } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    
    // Validate captcha for email signup when reCAPTCHA is configured
    if (isRecaptchaEnabled && !captchaToken) {
      setError("Please complete the CAPTCHA verification");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await signUp(email, password, username, firstName, lastName, captchaToken);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred during signup";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);
  
  const handleCaptchaChange = (token: string) => {
    setCaptchaToken(token);
    if (error === "Please complete the CAPTCHA verification") {
      setError(null);
    }
  };

  return (
    <AuthShell>
        <F1Card variant="default" className="w-full p-0">
          <F1CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <img src={f1Logo} alt="F1 DataStop" className="w-16 h-16" />
            </div>
            <F1CardTitle className="!text-2xl justify-center">Create an account</F1CardTitle>
            <F1CardDescription className="text-muted-foreground">
              Enter your information to create an account
            </F1CardDescription>
          </F1CardHeader>
          <F1CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPwFocused(true)}
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
                {(pwFocused || password.length > 0) && (
                  <PasswordChecklist password={password} className="pt-1" />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pr-10 bg-background"
                  />
                  <button
                    type="button"
                    onClick={toggleConfirmPasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              
              {isRecaptchaEnabled && (
              <div className="h-0 overflow-hidden">
                <ReCaptcha 
                  onChange={handleCaptchaChange}
                  version="v3"
                  hideBadge={true}
                />
              </div>
              )}
              
              {error && (
                <div className="p-3 rounded-md bg-destructive/20 border border-destructive/50 text-destructive-foreground text-sm">
                  {error}
                </div>
              )}
              
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={isLoading || !isPasswordValid(password)}
              >
                {isLoading ? "Creating account..." : "Sign up"}
              </Button>
              
              {isRecaptchaEnabled && (
              <div className="text-xs mt-2 text-center text-muted-foreground">
                This site is protected by reCAPTCHA and the Google{" "}
                <a 
                  href="https://policies.google.com/privacy"
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a 
                  href="https://policies.google.com/terms"
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Terms of Service
                </a>{" "}
                apply.
              </div>
              )}

              {/* X/Twitter Signup Button */}
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
                Sign up with X
              </Button>
            </form>
          </F1CardContent>
          <F1CardFooter className="flex justify-center border-t-0 pt-2">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </F1CardFooter>
        </F1Card>
    </AuthShell>
  );
};

export default Signup;
