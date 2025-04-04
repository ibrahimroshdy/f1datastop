
const MapLoadingOverlay = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-f1-red"></div>
    </div>
  );
};

export default MapLoadingOverlay;
