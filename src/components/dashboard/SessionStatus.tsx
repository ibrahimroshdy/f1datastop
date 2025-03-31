
import { format } from "date-fns";
import { useNextRace } from "@/hooks/useF1Data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          {countryEmoji} {race.raceName}
          <Badge className="ml-2" variant="secondary">Round {race.round}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-medium">{race.Circuit.circuitName}</p>
        <p className="text-muted-foreground">{formattedDate}</p>
      </CardContent>
    </Card>
  );
};

export default SessionStatus;
