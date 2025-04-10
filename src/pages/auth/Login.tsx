import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, ArrowLeft, Mail, Twitter } from 'lucide-react';
import f1Logo from '@/assets/f1-logo.svg';

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
    <div className="flex items-center justify-center min-h-screen bg-f1-black p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link 
            to="/" 
            className="inline-flex items-center text-gray-400 hover:text-white transition-colors"
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
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=950747&theme=light&t=1744238501973" 
              alt="F1 DataStop - Live formula 1 news and race data | Product Hunt" 
              style={{ width: "200px", height: "43px" }} 
              width="200" 
              height="43" 
            />
          </a>
        </div>
        
        <div className="mb-6 flex justify-center">
          <img src={f1Logo} alt="F1 DataStop" className="w-20 h-20" />
        </div>
        
        <Card className="w-full bg-f1-dark border-gray-800">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">
              {showForgotPassword ? "Reset Password" : "Sign In"}
            </CardTitle>
            <CardDescription>
              {showForgotPassword 
                ? "Enter your email address to receive a password reset link"
                : "Enter your email and password to access your account"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                    className="bg-gray-800 border-gray-700"
                  />
                </div>
                <div className="flex flex-col space-y-2">
                  <Button 
                    type="submit" 
                    className="w-full bg-f1-red hover:bg-red-700" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </Button>
                  <Button 
                    type="button"
                    variant="ghost"
                    onClick={() => setShowForgotPassword(false)}
                    className="text-gray-400"
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
                        className="bg-gray-800 border-gray-700 pl-10"
                      />
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Button 
                        type="button"
                        variant="link" 
                        className="text-sm text-f1-red p-0 h-auto"
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
                        className="bg-gray-800 border-gray-700 pr-10"
                      />
                      <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-200"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-f1-red hover:bg-red-700" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>

                {/* X/Twitter Login Button */}
                <div className="relative flex items-center justify-center mt-4">
                  <div className="absolute border-t border-gray-600 w-full"></div>
                  <span className="relative bg-f1-dark px-2 text-xs text-gray-400">OR</span>
                </div>

                <Button
                  type="button"
                  className="w-full mt-4 bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center"
                  onClick={() => signInWithX()}
                  disabled={isLoading}
                >
                  <Twitter className="mr-2 h-4 w-4" />
                  Sign in with X
                </Button>
              </>
            )}
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-gray-400">
              Don't have an account?{" "}
              <Link to="/auth/signup" className="text-f1-red hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Login;
