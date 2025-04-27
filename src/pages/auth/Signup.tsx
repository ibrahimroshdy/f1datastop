import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, ArrowLeft, Twitter } from 'lucide-react';
import ReCaptcha from '@/components/auth/ReCaptcha';
import { RECAPTCHA } from '@/constants/apiConfig';
import f1Logo from '@/assets/f1-logo.svg';
import { useTheme } from '@/context/ThemeContext';

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
  const [error, setError] = useState<string | null>(null);
  
  const { signUp, signInWithX } = useAuth();
  const { theme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    
    // Validate captcha for email signup
    if (!captchaToken) {
      setError("Please complete the CAPTCHA verification");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await signUp(email, password, username, firstName, lastName, captchaToken);
    } catch (error: any) {
      setError(error.message || "An error occurred during signup");
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
    <div className={`flex items-center justify-center min-h-screen p-4 ${theme === 'dark' ? 'bg-f1-black' : 'bg-gray-100'}`}>
      {/* Buy Me A Coffee widget */}
      <div className="fixed right-5 bottom-5 z-50">
        <a 
          href="https://www.buymeacoffee.com/f1datastop" 
          target="_blank" 
          rel="noopener noreferrer"
        >
          <img 
            src="https://img.buymeacoffee.com/button-api/?text=Buy me a PitStop&emoji=🚦&slug=f1datastop&button_colour=dd4040&font_colour=ffffff&font_family=Lato&outline_colour=ffffff&coffee_colour=FFDD00" 
            alt="Buy me a PitStop" 
            style={{ width: "180px", height: "40px" }} 
            width="180" 
            height="40" 
          />
        </a>
      </div>
      
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link 
            to="/" 
            className={`inline-flex items-center ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
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
        
        <Card className={`w-full ${theme === 'dark' ? 'bg-f1-dark border-gray-800' : 'bg-white border-gray-200'}`}>
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <img src={f1Logo} alt="F1 DataStop" className="w-16 h-16" />
            </div>
            <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
            <CardDescription className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
              Enter your information to create an account
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                    className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'}
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
                    className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'}
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
                  className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'}
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
                  className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'}
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
                    required
                    className={`pr-10 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'}`}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className={`absolute inset-y-0 right-0 pr-3 flex items-center ${theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
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
                    className={`pr-10 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'}`}
                  />
                  <button
                    type="button"
                    onClick={toggleConfirmPasswordVisibility}
                    className={`absolute inset-y-0 right-0 pr-3 flex items-center ${theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              
              {/* Google reCAPTCHA - invisible but present in DOM */}
              <div className="h-0 overflow-hidden">
                <ReCaptcha 
                  onChange={handleCaptchaChange}
                  version="v3"
                  hideBadge={true}
                />
              </div>
              
              {error && (
                <div className="p-3 rounded-md bg-red-900/50 border border-red-800 text-white text-sm">
                  {error}
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-f1-red hover:bg-red-700" 
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "Sign up"}
              </Button>
              
              {/* reCAPTCHA privacy notice */}
              <div className={`text-xs mt-2 text-center ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                This site is protected by reCAPTCHA and the Google{" "}
                <a 
                  href="https://policies.google.com/privacy"
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={theme === 'dark' ? 'text-gray-400 hover:text-gray-300 underline' : 'text-gray-600 hover:text-gray-800 underline'}
                >
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a 
                  href="https://policies.google.com/terms"
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={theme === 'dark' ? 'text-gray-400 hover:text-gray-300 underline' : 'text-gray-600 hover:text-gray-800 underline'}
                >
                  Terms of Service
                </a>{" "}
                apply.
              </div>

              {/* X/Twitter Signup Button */}
              <div className="relative flex items-center justify-center mt-4">
                <div className={`absolute border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'} w-full`}></div>
                <span className={`relative ${theme === 'dark' ? 'bg-f1-dark text-gray-400' : 'bg-white text-gray-500'} px-2 text-xs`}>OR</span>
              </div>

              <Button
                type="button"
                className={`w-full mt-4 text-white flex items-center justify-center ${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                onClick={() => signInWithX()}
                disabled={isLoading}
              >
                <Twitter className="mr-2 h-4 w-4" />
                Sign up with X
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Already have an account?{" "}
              <Link to="/auth/login" className="text-f1-red hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Signup;
