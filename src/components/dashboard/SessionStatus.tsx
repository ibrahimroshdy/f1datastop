
import { format } from "date-fns";
import { useNextRace } from "@/hooks/useF1Data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays } from "lucide-react";

interface SessionStatusProps {
  year?: number;
}

const SessionStatus = ({ year }: SessionStatusProps) => {
  const currentYear = new Date().getFullYear();
  const { data: nextRace, isLoading } = useNextRace(year || currentYear);
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            <Skeleton className="h-6 w-48" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    );
  }
  
  if (!nextRace?.data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">No Upcoming Race</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">The season might be over or data is not available.</p>
        </CardContent>
      </Card>
    );
  }
  
  const race = nextRace.data;
  const raceDate = new Date(race.date);
  const formattedDate = format(raceDate, "MMM d, yyyy");
  
  // Get clean race name (without emoji if present)
  const getRaceNameWithoutEmoji = (raceName: string) => {
    if (raceName.includes(' ') && raceName.indexOf(' ') <= 3) {
      return raceName.substring(raceName.indexOf(' ') + 1);
    }
    return raceName;
  };
  
  // Get emoji flag based on country name
  const getCountryEmoji = (countryName: string) => {
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
      Saudi: "🇸🇦",
      "Saudi Arabia": "🇸🇦",
      Singapore: "🇸🇬",
      Spain: "🇪🇸",
      UAE: "🇦🇪",
      "United Arab Emirates": "🇦🇪",
      UK: "🇬🇧",
      "United Kingdom": "🇬🇧",
      USA: "🇺🇸",
      "United States": "🇺🇸",
      Vietnam: "🇻🇳",
      Miami: "🇺🇸",
      Las: "🇺🇸", // Las Vegas
      Emilia: "🇮🇹", // Emilia-Romagna
    };
    
    // Try to find a matching country name
    for (const [key, emoji] of Object.entries(countryEmojis)) {
      if (countryName.includes(key)) {
        return emoji;
      }
    }
    
    return "🏁"; // Default racing flag
  };
  
  const countryName = race.Circuit?.Location?.country || "";
  const countryEmoji = getCountryEmoji(countryName);
  const raceName = getRaceNameWithoutEmoji(race.raceName);
  
  // Calculate days until the race
  const today = new Date();
  const daysUntil = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const daysText = daysUntil > 0 ? `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}` : 'today';
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <span>{countryEmoji}</span> {raceName}
          <Badge className="ml-2" variant="secondary">Round {race.round}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{race.Circuit.circuitName}</p>
            <p className="text-muted-foreground text-sm">{formattedDate}</p>
          </div>
          <div className="flex items-center gap-1 mt-1 sm:mt-0 text-sm bg-gray-800 rounded-lg px-2 py-1 text-gray-300">
            <CalendarDays size={14} className="text-f1-red" />
            <span>{daysText}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SessionStatus;
