
import React from 'react';
import { Button } from "@/components/ui/button";

interface DisplayModeToggleProps {
  displayMode: 'absolute' | 'gap';
  onToggle: () => void;
}

const DisplayModeToggle: React.FC<DisplayModeToggleProps> = ({ displayMode, onToggle }) => {
  // Completely disable the gap mode functionality to avoid axis issues
  return (
    <Button 
      onClick={onToggle}
      variant="outline"
      className="px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300 font-medium text-sm"
      size="sm"
      disabled={true} // Completely disable the toggle for now
    >
      Show Absolute Times
    </Button>
  );
};

export default DisplayModeToggle;
