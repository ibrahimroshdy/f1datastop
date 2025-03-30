
import { Button } from "@/components/ui/button";
import { Menu, Bell, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface TopBarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const TopBar = ({ sidebarOpen, setSidebarOpen }: TopBarProps) => {
  const isMobile = useIsMobile();
  const [notifications, setNotifications] = useState([
    { id: 1, message: "Verstappen sets fastest lap", time: "2 min ago" },
    { id: 2, message: "Hamilton pits for hard tyres", time: "5 min ago" },
    { id: 3, message: "Leclerc reporting engine issues", time: "10 min ago" },
  ]);

  return (
    <header className="h-16 border-b border-gray-800 bg-f1-dark flex items-center px-4 justify-between">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-gray-400 hover:text-white mr-2"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden md:flex items-center ml-2 gap-2">
          <div className="live-indicator">
            <span className="ml-1">LIVE: Monaco GP - Lap 45/78</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="h-10 w-[200px] rounded-md border border-gray-800 bg-f1-dark pl-8 pr-3 text-sm focus:border-f1-red focus:outline-none focus:ring-1 focus:ring-f1-red"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-gray-400 hover:text-white"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-f1-red"></span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b border-gray-800">
              <h4 className="font-medium">Notifications</h4>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-3 border-b border-gray-800 hover:bg-gray-800 cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <p className="text-sm">{notification.message}</p>
                    <span className="text-xs text-gray-400">{notification.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-2 text-center border-t border-gray-800">
              <Button variant="ghost" size="sm" className="w-full">
                View all notifications
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="ml-2 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-f1-dark border border-gray-700 flex items-center justify-center">
            <span className="text-xs font-medium">JD</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
