
interface TopBarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const TopBar = ({ sidebarOpen, setSidebarOpen }: TopBarProps) => {
  return (
    <header className="h-16 border-b border-gray-800 bg-f1-dark flex items-center px-4 justify-between">
      <div className="flex items-center">
        {/* Logo for small screens */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-f1-red flex items-center justify-center font-bold text-white">F1</div>
          <span className="font-bold tracking-tight">RaceHub</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Empty for now - can add user profile, settings, etc. */}
      </div>
    </header>
  );
};

export default TopBar;
