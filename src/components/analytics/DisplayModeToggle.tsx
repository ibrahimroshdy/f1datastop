
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
      className="px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-white border-gray-600 font-medium text-sm"
      size="lg"
    >
      Show {displayMode === 'absolute' ? 'Gaps' : 'Absolute Times'}
    </Button>
  );
};

export default DisplayModeToggle;
