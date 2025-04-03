
import { UserCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const UserMenu = () => {
  const { user, profile, signOut } = useAuth();

  if (!user) {
    return (
      <Link to="/auth/login">
        <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white font-medium">
          <UserCircle className="mr-2 h-4 w-4" />
          Sign In
        </Button>
      </Link>
    );
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
          {user.email && <p className="text-xs text-gray-400">{user.email}</p>}
        </div>
        <div className="border-t border-gray-700 my-2"></div>
        <div className="flex flex-col space-y-1">
          <Link to="/profile" className="text-sm px-2 py-1.5 hover:bg-gray-700 rounded-md transition-colors">
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
  );
};

export default UserMenu;
