
import React from 'react';
import { Button } from "@/components/ui/button";

interface DisplayModeToggleProps {
  displayMode: 'absolute' | 'gap';
  onToggle: () => void;
}

const DisplayModeToggle: React.FC<DisplayModeToggleProps> = ({ displayMode, onToggle }) => {
  return (
    <Button 
      onClick={onToggle}
      variant="outline"
      className="px-3 py-1 bg-f1-black hover:bg-gray-800 text-white border-gray-700 font-medium"
    >
      Show {displayMode === 'absolute' ? 'Gaps' : 'Absolute Times'}
    </Button>
  );
};

export default DisplayModeToggle;
