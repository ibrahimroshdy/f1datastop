import React from 'react';
import { QualifyingSession } from '@/hooks/useQualifyingData';

interface SessionToggleProps {
  activeSessions: QualifyingSession[];
  onSessionToggle: (session: QualifyingSession) => void;
}

const SessionToggle: React.FC<SessionToggleProps> = ({ 
  activeSessions, 
  onSessionToggle 
}) => {
  const isSessionActive = (session: QualifyingSession) => {
    if (session === 'all') {
      return activeSessions.includes('all');
    }
    return activeSessions.includes('all') || activeSessions.includes(session);
  };

  return (
    <div className="flex flex-col">
      <h3 className="text-sm font-medium mb-2">Qualifying Sessions</h3>
      <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg">
        <SessionButton 
          isActive={isSessionActive('all')} 
          onClick={() => onSessionToggle('all')}
          label="All"
        />
        <SessionButton 
          isActive={isSessionActive('Q1')} 
          onClick={() => onSessionToggle('Q1')}
          label="Q1"
          color="purple"
        />
        <SessionButton 
          isActive={isSessionActive('Q2')} 
          onClick={() => onSessionToggle('Q2')}
          label="Q2"
          color="blue"
        />
        <SessionButton 
          isActive={isSessionActive('Q3')} 
          onClick={() => onSessionToggle('Q3')}
          label="Q3"
          color="green"
        />
      </div>
    </div>
  );
};

interface SessionButtonProps {
  isActive: boolean;
  onClick: () => void;
  label: string;
  color?: 'purple' | 'blue' | 'green' | 'default';
}

const SessionButton: React.FC<SessionButtonProps> = ({ 
  isActive, 
  onClick, 
  label,
  color = 'default'
}) => {
  const getColorClasses = () => {
    if (!isActive) return 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400';
    
    switch (color) {
      case 'purple':
        return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800';
      case 'blue':
        return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
      case 'green':
        return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${getColorClasses()} flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium border transition-all`}
    >
      {label}
    </button>
  );
};

export default SessionToggle; 