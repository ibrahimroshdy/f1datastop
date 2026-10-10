import { useState, useEffect } from 'react';
import { getSupporterCount, getNextMilestone } from '@/config/supporters';
import { supabase } from '@/integrations/supabase/client';

// site_supporters isn't in the curated types — an untyped read for the live
// BuyMeACoffee count (kept current by the bmc-webhook edge function).
const supportersDb = supabase as unknown as {
  from: (t: string) => {
    select: (c: string) => {
      eq: (k: string, v: number) => {
        maybeSingle: () => Promise<{ data: { count?: number } | null }>;
      };
    };
  };
};

interface BuyMeCoffeeWidgetProps {
  size?: 'small' | 'large';
  position?: 'inline' | 'fixed';
  className?: string;
  showSupporterCount?: boolean;
  showNextMilestone?: boolean;
}

const BuyMeCoffeeWidget = ({ 
  size = 'small', 
  position = 'inline',
  className = '',
  showSupporterCount = false,
  showNextMilestone = false
}: BuyMeCoffeeWidgetProps) => {
  const [supporterCount, setSupporterCount] = useState(getSupporterCount());
  const [nextMilestone, setNextMilestone] = useState(getNextMilestone());

  useEffect(() => {
    // Config is the fallback; the live count (updated by the BMC webhook) wins.
    setSupporterCount(getSupporterCount());
    setNextMilestone(getNextMilestone());
    let alive = true;
    supportersDb
      .from('site_supporters')
      .select('count')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && typeof data?.count === 'number') setSupporterCount(data.count);
      });
    return () => {
      alive = false;
    };
  }, []);

  const dimensions = size === 'small' 
    ? { width: 120, height: 26 }
    : { width: 180, height: 40 };

  const buttonUrl = `https://img.buymeacoffee.com/button-api/?text=Buy me a PitStop&slug=f1datastop&button_colour=E10600&font_colour=ffffff&font_family=Lato&outline_colour=ffffff&coffee_colour=FFDD00&count=${supporterCount}`;

  const containerClasses = position === 'fixed'
    ? "fixed right-5 bottom-5 z-50"
    : "inline-block";

  const containerStyle =
    position === 'fixed'
      ? {
          right: 'calc(1.25rem + env(safe-area-inset-right))',
          bottom: 'calc(1.25rem + env(safe-area-inset-bottom))',
        }
      : undefined;

  return (
    <div className={`${containerClasses} ${className}`} style={containerStyle}>
      <a 
        href="https://www.buymeacoffee.com/f1datastop" 
        target="_blank" 
        rel="noopener noreferrer"
        className="transition-transform hover:scale-105"
      >
        <img 
          src={buttonUrl}
          alt={`Buy me a PitStop - ${supporterCount} supporters`}
          style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }} 
          width={dimensions.width}
          height={dimensions.height}
          loading="lazy"
        />
      </a>
      
      {/* Optional: Show supporter count as text */}
      {showSupporterCount && (
        <div className="text-xs text-center mt-1 text-muted-foreground">
          {supporterCount} supporter{supporterCount !== 1 ? 's' : ''}
        </div>
      )}
      
      {/* Optional: Show next milestone */}
      {showNextMilestone && nextMilestone && (
        <div className="text-xs text-center mt-1 text-muted-foreground">
          Next goal: {nextMilestone.count} supporters → {nextMilestone.reward}
        </div>
      )}
    </div>
  );
};

export default BuyMeCoffeeWidget; 