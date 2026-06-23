import { useState, useEffect } from 'react';
import { getSupporterCount, getNextMilestone } from '@/config/supporters';

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
    // Update counts from config
    setSupporterCount(getSupporterCount());
    setNextMilestone(getNextMilestone());
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