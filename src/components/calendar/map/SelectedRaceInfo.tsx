
import { format, parseISO } from "date-fns";
import { Race } from "@/components/calendar/map/types";
import { getCountryFlag } from "@/utils/countryUtils";

interface SelectedRaceInfoProps {
  race: Race;
  onClose: () => void;
}

const SelectedRaceInfo = ({ race, onClose }: SelectedRaceInfoProps) => {
  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700 shadow-xl z-20">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-white font-bold">
          {getCountryFlag(race.Circuit.Location.country)} {race.raceName}
        </h3>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white"
          aria-label="Close race information"
        >
          ×
        </button>
      </div>
      <div className="text-sm text-gray-300">
        <p>Round {race.round}</p>
        <p>{format(parseISO(race.date), 'dd MMMM yyyy')}</p>
        <p>{race.Circuit.circuitName}</p>
        <p>{race.Circuit.Location.locality}, {race.Circuit.Location.country}</p>
        <p className="text-xs mt-2 text-gray-400">
          Coordinates: {race.Circuit.Location.lat}, {race.Circuit.Location.long}
        </p>
      </div>
    </div>
  );
};

export default SelectedRaceInfo;
