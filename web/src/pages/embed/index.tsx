import React, { useEffect, useState } from "react";
import { useTheme } from '@/context/ThemeContext';

const EmbedInfoPage: React.FC = () => {
  const [domain, setDomain] = useState('https://f1datastop.com');
  const [copied, setCopied] = useState<string | null>(null);
  const { theme } = useTheme();
  const isDarkTheme = theme === 'dark';

  useEffect(() => {
    // Set document title and meta tags
    document.title = "F1 DataStop Embeddable Components";
    
    // Set domain based on host
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost') {
        setDomain(`${window.location.protocol}//${window.location.host}`);
      }
    }
    
    const metaDescription = document.createElement('meta');
    metaDescription.name = 'description';
    metaDescription.content = 'Embed F1 data on your website';
    document.head.appendChild(metaDescription);
    
    const metaRobots = document.createElement('meta');
    metaRobots.name = 'robots';
    metaRobots.content = 'index, follow';
    document.head.appendChild(metaRobots);
    
    return () => {
      document.head.removeChild(metaDescription);
      document.head.removeChild(metaRobots);
    };
  }, []);

  const copyToClipboard = (id: string, code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className={`max-w-4xl mx-auto p-6 font-sans ${isDarkTheme ? 'bg-background text-foreground' : 'bg-background text-foreground'}`}>
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">F1 DataStop Embeddable Components</h1>
        <p className="text-muted-foreground">Easily embed Formula 1 data on your website or blog</p>
      </header>
      
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Available Embeds</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted p-4 border-b border-border">
              <h3 className="text-xl font-medium">Driver Standings</h3>
            </div>
            <div className="p-4">
              <p className="mb-4">Display clean F1 driver standings with customizable theme and font.</p>
              <div className="flex justify-between items-center">
                <a 
                  href="/embed/driver-standings?season=2023" 
                  className="text-primary hover:underline"
                  target="_blank"
                >
                  View Demo
                </a>
                <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">Popular</span>
              </div>
              <div className="mt-4 relative">
                <div className="bg-muted rounded p-3 text-sm font-mono overflow-x-auto">
                  {`<iframe src="${domain}/embed/driver-standings?season=2023&theme=light&font=Inter" width="100%" height="500px" frameborder="0"></iframe>`}
                </div>
                <button 
                  onClick={() => copyToClipboard('driver', `<iframe src="${domain}/embed/driver-standings?season=2023&theme=light&font=Inter" width="100%" height="500px" frameborder="0"></iframe>`)}
                  className="absolute right-2 top-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs"
                >
                  {copied === 'driver' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
          
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted p-4 border-b border-border">
              <h3 className="text-xl font-medium">Constructor Standings</h3>
            </div>
            <div className="p-4">
              <p className="mb-4">Display clean F1 constructor standings with customizable theme and font.</p>
              <div className="flex justify-between items-center">
                <a 
                  href="/embed/constructor-standings?season=2023&theme=dark" 
                  className="text-primary hover:underline"
                  target="_blank"
                >
                  View Demo
                </a>
                <span className="px-3 py-1 bg-muted text-muted-foreground text-sm rounded-full">Clean</span>
              </div>
              <div className="mt-4 relative">
                <div className="bg-muted rounded p-3 text-sm font-mono overflow-x-auto">
                  {`<iframe src="${domain}/embed/constructor-standings?season=2023&theme=dark&font=Roboto" width="100%" height="400px" frameborder="0"></iframe>`}
                </div>
                <button 
                  onClick={() => copyToClipboard('constructor', `<iframe src="${domain}/embed/constructor-standings?season=2023&theme=dark&font=Roboto" width="100%" height="400px" frameborder="0"></iframe>`)}
                  className="absolute right-2 top-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs"
                >
                  {copied === 'constructor' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Customize Your Embed</h2>
        <div className="bg-muted p-6 rounded-lg border border-border">
          <h3 className="text-lg font-medium mb-3">URL Parameters</h3>
          <table className="w-full mb-6">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="text-left py-2 px-4 font-medium">Parameter</th>
                <th className="text-left py-2 px-4 font-medium">Description</th>
                <th className="text-left py-2 px-4 font-medium">Options</th>
                <th className="text-left py-2 px-4 font-medium">Default</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 px-4 font-mono text-sm">season</td>
                <td className="py-2 px-4">F1 season year</td>
                <td className="py-2 px-4">1950-present</td>
                <td className="py-2 px-4">Current year</td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono text-sm">theme</td>
                <td className="py-2 px-4">Color theme</td>
                <td className="py-2 px-4">light, dark</td>
                <td className="py-2 px-4">light</td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono text-sm">font</td>
                <td className="py-2 px-4">Font family</td>
                <td className="py-2 px-4">Inter, Roboto, etc.</td>
                <td className="py-2 px-4">Inter</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Implementation Tips</h2>
        <ul className="list-disc list-inside space-y-2 ml-4 text-muted-foreground">
          <li>Set the iframe width to <span className="font-mono">100%</span> for responsive design</li>
          <li>Set appropriate heights (e.g., 500px for driver standings, 400px for constructor standings)</li>
          <li>For custom fonts, use URL-encoded values (e.g., <span className="font-mono">Roboto,%20sans-serif</span>)</li>
          <li>Add a border with CSS if needed: <span className="font-mono">iframe &#123; border: 1px solid #eee; &#125;</span></li>
          <li>The components display just the table without any controls or headers for clean embedding</li>
        </ul>
      </section>
      
      <footer className="mt-12 pt-6 border-t border-border text-center text-muted-foreground text-sm">
        <p>© {new Date().getFullYear()} F1 DataStop. All rights reserved.</p>
        <p className="mt-1">Formula 1 championship data updated throughout the season.</p>
        <p className="mt-1">
          <a 
            href="/" 
            className="text-primary hover:underline"
          >
            Back to Main Site
          </a>
        </p>
      </footer>
    </div>
  );
};

export default EmbedInfoPage; 