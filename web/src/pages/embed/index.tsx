import React, { useEffect, useState } from "react";
import { F1Card, F1CardHeader, F1CardTitle, F1CardContent, F1Badge, PageHeader } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { EMBED_FONTS } from "@/components/embeddable/useEmbedParams";

const EmbedInfoPage: React.FC = () => {
  const [domain, setDomain] = useState('https://www.f1datastop.com');
  const [copied, setCopied] = useState<string | null>(null);

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
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-4xl", pageStack, "animate-fade-in")}>
      <PageHeader
        eyebrow="Embeds"
        title="F1 DataStop Embeddable Components"
        description="Easily embed Formula 1 data on your website or blog"
      />
      
      <section>
        <div className="instrument-label mb-3 text-primary">Available Embeds</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <F1Card variant="default">
            <F1CardHeader>
              <F1CardTitle>Driver Standings</F1CardTitle>
            </F1CardHeader>
            <F1CardContent>
              <p className="mb-4">Display clean F1 driver standings with customizable theme and font.</p>
              <div className="flex justify-between items-center">
                <a
                  href="/embed/driver-standings?season=2023"
                  className="text-primary hover:underline"
                  target="_blank"
                >
                  View Demo
                </a>
                <F1Badge className="bg-status-completed/20 text-status-completed border border-status-completed/30">Popular</F1Badge>
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
            </F1CardContent>
          </F1Card>

          <F1Card variant="default">
            <F1CardHeader>
              <F1CardTitle>Constructor Standings</F1CardTitle>
            </F1CardHeader>
            <F1CardContent>
              <p className="mb-4">Display clean F1 constructor standings with customizable theme and font.</p>
              <div className="flex justify-between items-center">
                <a
                  href="/embed/constructor-standings?season=2023&theme=dark"
                  className="text-primary hover:underline"
                  target="_blank"
                >
                  View Demo
                </a>
                <F1Badge>Clean</F1Badge>
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
            </F1CardContent>
          </F1Card>
        </div>
      </section>

      <section>
        <div className="instrument-label mb-3 text-primary">Customize Your Embed</div>
        <F1Card>
          <F1CardHeader>
            <F1CardTitle>URL Parameters</F1CardTitle>
          </F1CardHeader>
          <F1CardContent>
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
                <td className="py-2 px-4">Any year (number)</td>
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
                <td className="py-2 px-4">{EMBED_FONTS.join(", ")}</td>
                <td className="py-2 px-4">Inter</td>
              </tr>
            </tbody>
          </table>
          </F1CardContent>
        </F1Card>
      </section>

      <section>
        <div className="instrument-label mb-3 text-primary">Implementation Tips</div>
        <ul className="list-disc list-inside space-y-2 ml-4 text-muted-foreground">
          <li>Set the iframe width to <span className="font-mono">100%</span> for responsive design</li>
          <li>Set appropriate heights (e.g., 500px for driver standings, 400px for constructor standings)</li>
          <li>
            <span className="font-mono">font</span> accepts only {EMBED_FONTS.join(", ")} (use <span className="font-mono">Open%20Sans</span> in a URL); any other value falls back to Inter
          </li>
          <li>Any <span className="font-mono">theme</span> other than <span className="font-mono">dark</span> renders light</li>
          <li>Add a border with CSS if needed: <span className="font-mono">iframe &#123; border: 1px solid #eee; &#125;</span></li>
          <li>The components display just the table without any controls or headers for clean embedding</li>
        </ul>
      </section>
      
      <footer className="border-t border-border pt-6 text-center text-sm text-muted-foreground">
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
    </div>
  );
};

export default EmbedInfoPage; 