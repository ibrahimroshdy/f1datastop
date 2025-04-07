import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Loader2 } from "lucide-react";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
interface LastRaceResultsCardProps {
  lastRaceResults: any;
  isResultsLoading: boolean;
  getTeamColor: (constructorId: string) => string;
}
const LastRaceResultsCard = ({
  lastRaceResults,
  isResultsLoading,
  getTeamColor
}: LastRaceResultsCardProps) => {
  return <Card className="bg-gray-900 border-gray-800 flex ">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-f1-red" />
          Last Race Results
        </CardTitle>
      </CardHeader>
      <CardContent className="">
        {isResultsLoading ? <div className="space-y-2">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div> : !lastRaceResults?.data?.raceName ? <p className="text-gray-400">No recent race data available</p> : <>
            <div className="mb-3">
              <h3 className="font-bold text-lg">
                {lastRaceResults?.data?.raceName ? getRaceNameWithoutEmoji(lastRaceResults?.data?.raceName) : "No race data"}
              </h3>
            </div>
            <div className="space-y-2.5 flex-1">
              {lastRaceResults?.data?.results?.slice(0, 5).map(result => <div key={result.position} className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium w-6">{result.position}</span>
                    <div className={`w-1.5 h-6 ${getTeamColor(result.Constructor.constructorId)} rounded-sm`}></div>
                    <span>{result.Driver.code}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {result.position === '1' ? result.Time?.time : result.Time?.time.startsWith('+') ? result.Time.time : result.status === "Finished" ? "+" + result.Time?.time : result.status}
                    </div>
                  </div>
                </div>)}
              {/* Additional bottom padding/margin to ensure proper spacing */}
              <div className="h-6"></div>
            </div>
          </>}
      </CardContent>
    </Card>;
};
export default LastRaceResultsCard;