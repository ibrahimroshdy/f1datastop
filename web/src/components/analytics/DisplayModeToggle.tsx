import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeftRight } from 'lucide-react';

interface DisplayModeToggleProps {
  displayMode: 'absolute' | 'gap';
  onToggle: () => void;
}

const DisplayModeToggle: React.FC<DisplayModeToggleProps> = ({ displayMode, onToggle }) => {
  return (
    <Button 
      onClick={onToggle}
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 text-xs"
    >
      <ArrowLeftRight className="h-3.5 w-3.5" />
      {displayMode === 'absolute' ? 'Gap Times' : 'Lap Times'}
    </Button>
  );
};

export default DisplayModeToggle;
