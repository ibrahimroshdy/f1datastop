
const MapLegend = () => {
  return (
    <div className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur-sm rounded-md p-2 border border-gray-700 z-10">
      <div className="text-xs text-white font-medium mb-1">Race Legend</div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3 h-3 rounded-full bg-green-500 border border-white"></div>
        <span className="text-xs text-gray-200">First Race</span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3 h-3 rounded-full bg-red-600 border border-white"></div>
        <span className="text-xs text-gray-200">Upcoming Races</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-gray-500 border border-white"></div>
        <span className="text-xs text-gray-200">Completed Races</span>
      </div>
    </div>
  );
};

export default MapLegend;
