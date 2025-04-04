
import { format, parseISO } from "date-fns";
import { Race } from "@/components/calendar/map/types";
import { getCountryFlag } from "@/utils/countryUtils";
import { X, Calendar, Map, Info, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface SelectedRaceInfoProps {
  race: Race;
  onClose: () => void;
}

const SelectedRaceInfo = ({ race, onClose }: SelectedRaceInfoProps) => {
  const [activeTab, setActiveTab] = useState<'info'|'stats'|'weather'>('info');
  
  const getLocalTime = () => {
    try {
      // This is a simplified approach - in a real app, you'd want to use a library like moment-timezone
      const raceTimeString = race.time || '14:00:00Z'; // Default to 2PM if no time provided
      const raceDate = parseISO(`${race.date}T${raceTimeString}`);
      return format(raceDate, 'HH:mm');
    } catch (e) {
      return "14:00"; // Default time
    }
  };
  
  const getTrackInfo = () => {
    // This would be replaced with actual data from an API
    const tracks: {[key: string]: {length: string, laps: number, turns: number}} = {
      "Bahrain International Circuit": { length: "5.412 km", laps: 57, turns: 15 },
      "Jeddah Corniche Circuit": { length: "6.174 km", laps: 50, turns: 27 },
      "Albert Park Circuit": { length: "5.278 km", laps: 58, turns: 14 },
      "Suzuka Circuit": { length: "5.807 km", laps: 53, turns: 18 },
      "Shanghai International Circuit": { length: "5.451 km", laps: 56, turns: 16 },
      "Miami International Autodrome": { length: "5.412 km", laps: 57, turns: 19 },
      "Autodromo Enzo e Dino Ferrari": { length: "4.909 km", laps: 63, turns: 19 },
      "Circuit de Monaco": { length: "3.337 km", laps: 78, turns: 19 },
      "Circuit Gilles Villeneuve": { length: "4.361 km", laps: 70, turns: 14 },
      "Circuit de Barcelona-Catalunya": { length: "4.675 km", laps: 66, turns: 16 },
      "Red Bull Ring": { length: "4.318 km", laps: 71, turns: 10 },
      "Silverstone Circuit": { length: "5.891 km", laps: 52, turns: 18 },
      "Hungaroring": { length: "4.381 km", laps: 70, turns: 14 },
      "Circuit de Spa-Francorchamps": { length: "7.004 km", laps: 44, turns: 19 },
      "Circuit Zandvoort": { length: "4.259 km", laps: 72, turns: 14 },
      "Monza Circuit": { length: "5.793 km", laps: 53, turns: 11 },
      "Baku City Circuit": { length: "6.003 km", laps: 51, turns: 20 },
      "Marina Bay Street Circuit": { length: "5.063 km", laps: 62, turns: 19 },
      "Circuit of the Americas": { length: "5.513 km", laps: 56, turns: 20 },
      "Autódromo Hermanos Rodríguez": { length: "4.304 km", laps: 71, turns: 17 },
      "Interlagos Circuit": { length: "4.309 km", laps: 71, turns: 15 },
      "Las Vegas Strip Circuit": { length: "6.120 km", laps: 50, turns: 17 },
      "Losail International Circuit": { length: "5.380 km", laps: 57, turns: 16 },
      "Yas Marina Circuit": { length: "5.281 km", laps: 58, turns: 16 },
    };
    
    return tracks[race.Circuit.circuitName] || { length: "~5.0 km", laps: 50, turns: 15 };
  };

  const trackInfo = getTrackInfo();
  
  return (
    <div className="absolute bottom-0 right-0 w-full md:w-auto md:right-4 md:bottom-4 md:max-w-sm bg-black/90 backdrop-blur-sm rounded-lg p-5 border border-gray-700 shadow-xl z-20 overflow-hidden">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-white font-bold text-lg flex items-center">
          {getCountryFlag(race.Circuit.Location.country)} {race.raceName}
        </h3>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800"
          aria-label="Close race information"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex border-b border-gray-700 mb-3">
        <button 
          onClick={() => setActiveTab('info')} 
          className={`px-3 py-2 text-sm ${activeTab === 'info' ? 'text-white border-b-2 border-f1-red font-medium' : 'text-gray-400'}`}
        >
          Info
        </button>
        <button 
          onClick={() => setActiveTab('stats')} 
          className={`px-3 py-2 text-sm ${activeTab === 'stats' ? 'text-white border-b-2 border-f1-red font-medium' : 'text-gray-400'}`}
        >
          Track Stats
        </button>
        <button 
          onClick={() => setActiveTab('weather')} 
          className={`px-3 py-2 text-sm ${activeTab === 'weather' ? 'text-white border-b-2 border-f1-red font-medium' : 'text-gray-400'}`}
        >
          Weather
        </button>
      </div>

      {activeTab === 'info' && (
        <div className="text-sm text-gray-300 space-y-3">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-white">Round {race.round}</div>
              <div>{format(parseISO(race.date), 'dd MMMM yyyy')}</div>
              <div>Race start: {getLocalTime()} local time</div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Map className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-white">{race.Circuit.circuitName}</div>
              <div>{race.Circuit.Location.locality}, {race.Circuit.Location.country}</div>
              <div className="text-xs text-gray-400 mt-1">
                {race.Circuit.Location.lat}°, {race.Circuit.Location.long}°
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap mt-3">
            {race.FirstPractice && (
              <Badge variant="outline" className="text-xs">
                FP1: {format(parseISO(race.FirstPractice.date), 'dd MMM')}
              </Badge>
            )}
            {race.SecondPractice && (
              <Badge variant="outline" className="text-xs">
                FP2: {format(parseISO(race.SecondPractice.date), 'dd MMM')}
              </Badge>
            )}
            {race.ThirdPractice && (
              <Badge variant="outline" className="text-xs">
                FP3: {format(parseISO(race.ThirdPractice.date), 'dd MMM')}
              </Badge>
            )}
            {race.Qualifying && (
              <Badge variant="outline" className="text-xs bg-gray-800">
                Quali: {format(parseISO(race.Qualifying.date), 'dd MMM')}
              </Badge>
            )}
            {race.Sprint && (
              <Badge variant="outline" className="text-xs bg-gray-800 border-f1-red text-f1-red">
                Sprint: {format(parseISO(race.Sprint.date), 'dd MMM')}
              </Badge>
            )}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="text-sm text-gray-300 space-y-3">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-white">Track Details</div>
              <div>Track length: {trackInfo.length}</div>
              <div>Race laps: {trackInfo.laps}</div>
              <div>Corners: {trackInfo.turns}</div>
              <div>Race distance: {(parseFloat(trackInfo.length) * trackInfo.laps).toFixed(3)} km</div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-white">Lap Records</div>
              <div>Qualifying: Data not available</div>
              <div>Race: Data not available</div>
              <div className="mt-2 text-xs text-gray-500">
                Historic results will appear here when available
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'weather' && (
        <div className="text-sm text-gray-300 flex flex-col items-center justify-center py-4">
          <div className="text-center mb-3">
            <div className="font-semibold text-white">Weather Forecast</div>
            <div className="text-xs text-gray-400">Data not available yet</div>
          </div>
          <div className="text-center text-gray-500 text-xs">
            Weather information will be available closer to race day
          </div>
        </div>
      )}
      
      <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between">
        <a 
          href={`/calendar?year=${race.season}&race=${race.round}`} 
          className="text-sm text-f1-red hover:text-f1-red/80"
        >
          View complete race details
        </a>
        
        <a 
          href={race.Circuit.url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Official circuit info
        </a>
      </div>
    </div>
  );
};

export default SelectedRaceInfo;
