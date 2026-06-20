import React, { useState, useEffect } from 'react';
import { checkClarityStatus } from '../../integrations/clarity/clarityHelpers';
import { useTheme } from '@/context/ThemeContext';
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle } from '@/components/f1';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ClarityStatusProps {
  projectId: string;
}

/**
 * Component to verify if Microsoft Clarity is working correctly
 * Only use this component during development!
 */
const ClarityStatus: React.FC<ClarityStatusProps> = ({ projectId }) => {
  const { isGlass } = useTheme();
  const [status, setStatus] = useState({
    isAvailable: false,
    isLoaded: false,
    hasQueue: false,
    queueLength: 0,
    isFullyFunctional: false,
    isNpmPackageAvailable: false,
    lastChecked: new Date()
  });
  
  const checkStatus = () => {
    const clarityStatus = checkClarityStatus();
    setStatus({
      ...clarityStatus,
      lastChecked: new Date()
    });
  };
  
  const sendTestEvent = () => {
    if (typeof window !== 'undefined' && window.clarity) {
      try {
        window.clarity('event', 'test_event_' + Date.now());
        window.clarity('set', 'test_tag', 'test_value_' + Date.now());
        alert('Test event sent to Clarity! Check your dashboard in 20-30 minutes.');
      } catch (error) {
        alert('Failed to send test event: ' + error);
      }
    } else {
      alert('Clarity is not available');
    }
  };
  
  useEffect(() => {
    // Initial check
    checkStatus();
    
    // Set up interval to check status every 5 seconds
    const intervalId = setInterval(checkStatus, 5000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Only render in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  
  return (
    <F1Card 
      variant={isGlass ? "glass" : "default"}
      glassVariant={isGlass ? "panel" : "default"}
      className={cn(
        "fixed bottom-3 left-3 z-[9999] max-w-[300px] text-xs",
        isGlass && "border-white/10"
      )}
    >
      <F1CardHeader className="pb-2">
        <F1CardTitle className="text-sm">Microsoft Clarity Status</F1CardTitle>
      </F1CardHeader>
      <F1CardContent className="space-y-3">
        <div>
          <strong className="text-foreground">Project ID:</strong>{' '}
          <span className="text-muted-foreground">
            {projectId.substring(0, 4)}...{projectId.substring(projectId.length - 4)}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
            <strong className="text-foreground">Available:</strong>
            <span className={status.isAvailable ? 'text-emerald-500' : 'text-red-500'}>
              {status.isAvailable ? ' ✓' : ' ✗'}
            </span>
          </div>
          
          <div>
            <strong className="text-foreground">Loaded:</strong>
            <span className={status.isLoaded ? 'text-emerald-500' : 'text-red-500'}>
              {status.isLoaded ? ' ✓' : ' ✗'}
            </span>
          </div>
          
          <div>
            <strong className="text-foreground">Has Queue:</strong>
            <span className={status.hasQueue ? 'text-emerald-500' : 'text-red-500'}>
              {status.hasQueue ? ' ✓' : ' ✗'}
            </span>
          </div>
          
          <div>
            <strong className="text-foreground">Queue Items:</strong>{' '}
            <span className="text-muted-foreground">{status.queueLength}</span>
          </div>
          
          <div>
            <strong className="text-foreground">Functional:</strong>
            <span className={status.isFullyFunctional ? 'text-emerald-500' : 'text-red-500'}>
              {status.isFullyFunctional ? ' ✓' : ' ✗'}
            </span>
          </div>
          
          <div>
            <strong className="text-foreground">NPM Package:</strong>
            <span className={status.isNpmPackageAvailable ? 'text-emerald-500' : 'text-red-500'}>
              {status.isNpmPackageAvailable ? ' ✓' : ' ✗'}
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={checkStatus}
            size="sm"
            variant="default"
            className="flex-1 h-7 text-[10px]"
          >
            Check Now
          </Button>
          
          <Button 
            onClick={sendTestEvent}
            size="sm"
            variant="default"
            className="flex-1 h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700"
          >
            Send Test Event
          </Button>
        </div>
        
        <div className="text-[10px] text-muted-foreground text-center">
          Last checked: {status.lastChecked.toLocaleTimeString()}
        </div>
      </F1CardContent>
    </F1Card>
  );
};

export default ClarityStatus; 