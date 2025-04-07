
import React from 'react';
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

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
      className="px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300 font-medium text-sm flex items-center gap-1"
    >
      {displayMode === 'absolute' ? (
        <>
          Show Gaps 
          <ChevronDown className="h-3 w-3 ml-1" />
        </>
      ) : (
        <>
          Show Absolute Times
          <ChevronUp className="h-3 w-3 ml-1" />
        </>
      )}
    </Button>
  );
};

export default DisplayModeToggle;
