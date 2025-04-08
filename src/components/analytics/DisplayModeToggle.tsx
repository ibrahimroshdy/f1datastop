
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
      onClick={() => {}} // No-op function to prevent any toggle
      variant="outline"
      className="px-3 py-1 rounded-md bg-gray-100 text-gray-800 border-gray-300 font-medium text-sm cursor-not-allowed opacity-60"
      size="sm"
      disabled={true}
    >
      Show Absolute Times Only
    </Button>
  );
};

export default DisplayModeToggle;
