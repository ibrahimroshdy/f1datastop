import { Link, Navigate } from 'react-router-dom';
import { useDeveloper } from '@/context/DeveloperContext';
import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardHeader,
  F1CardTitle,
  PageHeader,
} from '@/components/f1';
import { pageShell, pageStack } from '@/lib/layout';
import { Settings, Code, Terminal, Database, ExternalLink, LayoutTemplate, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

const Developers = () => {
  const { isDeveloperMode } = useDeveloper();
  const { isGlass } = useTheme();
  const cardVariant = isGlass ? 'glass' : 'default';
  const glassVariant = isGlass ? 'panel' : 'default';

  // Redirect if not in developer mode
  if (!isDeveloperMode) {
    return <Navigate to="/" replace />;
  }

  const developerTools = [
    {
      name: 'Embeddable Components',
      description: 'Embed F1 DataStop components on external websites',
      icon: LayoutTemplate,
      href: '/embed',
      external: true,
      available: true
    },
    {
      name: 'API Documentation',
      description: 'Explore the F1 DataStop API',
      icon: Code,
      href: '/developers/api',
      external: false,
      available: false
    },
    {
      name: 'Database Schema',
      description: 'View database structure and relationships',
      icon: Database,
      href: '/developers/schema',
      external: false,
      available: false
    },
    {
      name: 'Console',
      description: 'Advanced debugging tools',
      icon: Terminal,
      href: '/developers/console',
      external: false,
      available: false
    },
    {
      name: 'Configuration',
      description: 'Adjust developer settings',
      icon: Settings,
      href: '/developers/config',
      external: false,
      available: false
    }
  ];

  return (
    <div className={pageShell}>
      <div className={cn(pageStack, "animate-fade-in")}>
        <PageHeader
          title="Developers PitStop"
          description="Advanced tools and settings for developers"
          actions={
            <div className="instrument-label px-3 py-1 bg-primary/10 text-primary rounded-md">
              Developer Mode
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {developerTools.map((tool) => (
            <F1Card
              key={tool.name}
              variant={cardVariant}
              glassVariant={glassVariant}
              className={cn(
                "p-0 transition-colors duration-200",
                tool.available ? "hover:border-primary/40" : "opacity-70"
              )}
            >
              <F1CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="p-2 border border-border rounded-md text-muted-foreground">
                    {tool.available ? (
                      <tool.icon className="h-5 w-5" />
                    ) : (
                      <Clock className="h-5 w-5" />
                    )}
                  </div>
                  
                  {tool.external && tool.available && (
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <F1CardTitle className="!text-xl mt-2">{tool.name}</F1CardTitle>
                <F1CardDescription>{tool.description}</F1CardDescription>
              </F1CardHeader>
              <F1CardContent>
                {tool.available ? (
                  tool.external ? (
                    <a 
                      href={tool.href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline inline-flex items-center"
                    >
                      Open in new tab
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  ) : (
                    <Link 
                      to={tool.href} 
                      className="text-sm text-primary hover:underline"
                    >
                      Open tool
                    </Link>
                  )
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Coming soon
                  </span>
                )}
              </F1CardContent>
            </F1Card>
          ))}
        </div>

        <div className="mt-8 border border-border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">
            <p>
              <strong>Note:</strong> The developer tools are intended for advanced users. 
              Use with caution as some actions may affect the application behavior.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Developers; 