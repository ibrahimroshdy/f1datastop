
import { useNextRace } from "@/hooks/useF1Data";
import { CalendarDays, Menu, UserCircle } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface TopBarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const TopBar = ({ sidebarOpen, setSidebarOpen }: TopBarProps) => {
  const { data: nextRaceData, isLoading } = useNextRace();
  const { user, profile, signOut } = useAuth();
  
  const nextRace = nextRaceData?.data;
  
  const formatDateString = (dateStr: string, timeStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      
      const date = new Date(year, month - 1, day, hour, minute);
      
      return format(date, 'EEE, MMM d, yyyy - HH:mm');
    } catch (error) {
      console.error("Error parsing date:", error);
      return "Date unavailable";
    }
  };

  const getRaceNameWithoutEmoji = (raceName: string) => {
    if (raceName && raceName.includes(' ') && raceName.indexOf(' ') <= 3) {
      return raceName.substring(raceName.indexOf(' ') + 1);
    }
    return raceName;
  };

  const getCountryFlag = (country: string) => {
    const countryEmojis: Record<string, string> = {
      Australia: "🇦🇺",
      Austria: "🇦🇹",
      Azerbaijan: "🇦🇿",
      Bahrain: "🇧🇭",
      Belgium: "🇧🇪",
      Brazil: "🇧🇷",
      Canada: "🇨🇦",
      China: "🇨🇳",
      France: "🇫🇷",
      Germany: "🇩🇪",
      Hungary: "🇭🇺",
      Italy: "🇮🇹",
      Japan: "🇯🇵",
      Mexico: "🇲🇽",
      Monaco: "🇲🇨",
      Netherlands: "🇳🇱",
      Portugal: "🇵🇹",
      Qatar: "🇶🇦",
      Russia: "🇷🇺",
      "Saudi Arabia": "🇸🇦",
      Singapore: "🇸🇬",
      Spain: "🇪🇸",
      "United Arab Emirates": "🇦🇪",
      "United Kingdom": "🇬🇧",
      "United States": "🇺🇸",
      USA: "🇺🇸",
    };
    
    return countryEmojis[country] || "🏁";
  };

  let raceName = "";
  let flag = "";
  if (nextRace) {
    raceName = getRaceNameWithoutEmoji(nextRace.raceName);
    flag = getCountryFlag(nextRace.Circuit?.Location?.country || "");
  }

  const getInitials = () => {
    if (profile) {
      const firstName = profile.first_name || '';
      const lastName = profile.last_name || '';
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const getDisplayName = () => {
    if (profile && (profile.first_name || profile.last_name)) {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    if (profile?.username) {
      return profile.username;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return "User";
  };

  return (
    <header className="h-16 border-b border-gray-800 bg-f1-dark flex items-center px-4 justify-between">
      <div className="flex items-center">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden mr-3 text-gray-400 hover:text-white"
          aria-label="Toggle menu"
        >
          <Menu size={24} />
        </button>
        
        <div className="md:hidden flex items-center gap-2">
          <svg
            className="w-8 h-8"
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="50" cy="50" r="50" fill="#252530" />
            <circle cx="50" cy="50" r="45" fill="#e10600" />
            <circle cx="50" cy="50" r="38" fill="#252530" />
            <path
              d="M20 50 H27 V35 H32 L38 50 H47 L40 33 C44 31 46 28 46 24 C46 18 42 15 35 15 H20 V50 Z"
              fill="white"
            />
            <path
              d="M27 29 V22 H33 C36 22 37 23 37 25.5 C37 28 36 29 33 29 H27 Z"
              fill="white"
            />
            <path 
              d="M50 15 V50 H57 V37 H70 V50 H77 V15 H70 V30 H57 V15 H50 Z"
              fill="white" 
            />
            <path
              d="M82.5 40 V15 H95 C100 15 105 20 105 27.5 C105 35 100 40 95 40 H82.5 Z M89.5 34 H93 C96 34 98 32 98 27.5 C98 23 96 21 93 21 H89.5 V34 Z"
              fill="white"
            />
            <text 
              x="50" 
              y="70" 
              fontFamily="Arial, sans-serif" 
              fontSize="12" 
              fontWeight="bold" 
              textAnchor="middle" 
              fill="white"
            >DATASTOP</text>
          </svg>
          <span className="font-bold tracking-tight">DataStop</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {!isLoading && nextRace && (
          <div className="hidden md:flex items-center gap-2 text-sm bg-gray-800 rounded-lg px-3 py-1.5">
            <CalendarDays size={16} className="text-f1-red" />
            <div>
              <span className="font-medium">Next Race:</span>{' '}
              <span className="text-gray-300">{flag} {raceName}</span>{' '}
              {nextRace.date && nextRace.time && (
                <span className="text-gray-400">
                  {formatDateString(nextRace.date, nextRace.time)}
                </span>
              )}
            </div>
          </div>
        )}

        {user ? (
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Avatar className="h-8 w-8 border border-gray-700">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="bg-f1-red text-white text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline-block text-sm font-medium text-gray-200">
                  {getDisplayName()}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 bg-gray-800 border-gray-700 text-white p-2" align="end">
              <div className="flex flex-col space-y-1 p-2">
                <p className="text-sm font-medium">{getDisplayName()}</p>
                {user.email && (
                  <p className="text-xs text-gray-400">{user.email}</p>
                )}
              </div>
              <div className="border-t border-gray-700 my-2"></div>
              <div className="flex flex-col space-y-1">
                <Link 
                  to="/profile" 
                  className="text-sm px-2 py-1.5 hover:bg-gray-700 rounded-md transition-colors"
                >
                  Profile Settings
                </Link>
                <button
                  onClick={signOut}
                  className="text-sm px-2 py-1.5 text-left hover:bg-gray-700 rounded-md transition-colors text-red-400 hover:text-red-300"
                >
                  Sign Out
                </button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <Link to="/auth/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-300 hover:text-white"
            >
              <UserCircle className="mr-2 h-4 w-4" />
              Sign In
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
};

export default TopBar;
