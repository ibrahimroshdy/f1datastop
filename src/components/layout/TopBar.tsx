
import { useNextRace } from "@/hooks/useF1Data";
import { CalendarDays } from "lucide-react";
import { format, addHours } from "date-fns";

interface TopBarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const TopBar = ({ sidebarOpen, setSidebarOpen }: TopBarProps) => {
  const { data: nextRaceData, isLoading } = useNextRace();
  
  const nextRace = nextRaceData?.data;
  
  const formatDateString = (dateStr: string, timeStr: string) => {
    try {
      // Parse date and time strings to create Date object
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      
      // JavaScript months are 0-indexed
      const date = new Date(year, month - 1, day, hour, minute);
      
      // Format the date for display
      return format(date, 'EEE, MMM d, yyyy - HH:mm');
    } catch (error) {
      console.error("Error parsing date:", error);
      return "Date unavailable";
    }
  };

  return (
    <header className="h-16 border-b border-gray-800 bg-f1-dark flex items-center px-4 justify-between">
      <div className="flex items-center">
        {/* Logo for small screens */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-f1-red flex items-center justify-center font-bold text-white">F1</div>
          <span className="font-bold tracking-tight">RaceHub</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {!isLoading && nextRace && (
          <div className="hidden md:flex items-center gap-2 text-sm bg-gray-800 rounded-lg px-3 py-1.5">
            <CalendarDays size={16} className="text-f1-red" />
            <div>
              <span className="font-medium">Next Race:</span>{' '}
              <span className="text-gray-300">{nextRace.raceName?.replace(/^[🇦-🇿]{2}\s/, '')}</span>{' '}
              {nextRace.date && nextRace.time && (
                <span className="text-gray-400">
                  {formatDateString(nextRace.date, nextRace.time)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default TopBar;
