import { Link } from 'react-router-dom';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { Twitter, Coffee, Heart, ExternalLink } from 'lucide-react';
import f1Logo from '@/assets/f1-logo.svg';

const Footer = () => {
  const { isGlass } = useTheme();
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { name: 'Dashboard', href: '/' },
    { name: 'Race Calendar', href: '/calendar' },
    { name: 'Race Analysis', href: '/race-analysis' },
    { name: 'Drivers', href: '/drivers' },
    { name: 'Constructors', href: '/constructors' },
  ];

  const legalLinks = [
    { name: 'Privacy Policy', href: '/privacy' },
  ];

  const socialLinks = [
    {
      name: 'Twitter',
      href: 'https://twitter.com/f1datastop',
      icon: Twitter,
      external: true,
    },
    { 
      name: 'Buy Me a Coffee', 
      href: 'https://buymeacoffee.com/f1datastop', 
      icon: Coffee,
      external: true 
    },
  ];

  return (
    <footer className={cn(
      "relative mt-auto",
      isGlass 
        ? "glass-panel border-t border-white/5" 
        : "bg-card border-t border-border"
    )}>
      <div className="mx-auto w-full max-w-[1600px] px-4 md:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand section */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-3 group mb-4">
              <div className={cn(
                "p-2 rounded-xl transition-all duration-300",
                isGlass 
                  ? "glass group-hover:shadow-glow" 
                  : "bg-primary/10 group-hover:bg-primary/20"
              )}>
                <img src={f1Logo} alt="F1 DataStop" className="w-8 h-8" />
              </div>
          <div>
                <span className="font-bold text-lg tracking-tight block">
                  F1 DataStop
                </span>
                <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wider uppercase">
                  Race Analytics
                </span>
              </div>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The ultimate destination for Formula 1 statistics, live race data, and comprehensive analytics.
            </p>
            
            {/* Social links */}
            <div className="flex items-center gap-2 mt-4">
              {socialLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "p-2 rounded-lg transition-all duration-200",
                    isGlass 
                      ? "glass-button hover:shadow-glow" 
                      : "bg-muted hover:bg-accent"
                  )}
                  aria-label={link.name}
                >
                  <link.icon className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link 
                    to={link.href} 
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center gap-1 group"
                  >
                    <span className="group-hover:translate-x-1 transition-transform duration-200">
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
              Legal
            </h3>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.name}>
                  <Link 
                    to={link.href} 
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
              Support Us
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Help us keep F1 DataStop running.
            </p>
            <a
              href="https://buymeacoffee.com/f1datastop"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                isGlass 
                  ? "glass-button hover:shadow-glow" 
                  : "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
              )}
            >
              <Coffee className="h-4 w-4" />
              Buy us a PitStop
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className={cn(
          "mt-8 pt-6 text-sm",
          isGlass ? "border-t border-white/5" : "border-t border-border"
        )}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-muted-foreground flex items-center gap-1">
              © {currentYear} F1 DataStop. Made with 
              <Heart className="h-3 w-3 text-primary fill-primary" /> 
              for F1 fans.
            </p>
            <p className="text-xs text-muted-foreground/70 text-center md:text-right max-w-md">
              We use Microsoft Clarity to improve our products. By using our site, you agree to our{' '}
              <Link to="/privacy" className="underline hover:text-foreground transition-colors">
                privacy policy
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 
