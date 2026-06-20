import React from 'react';
import { useSessionsByYear } from '@/hooks/useOpenF1Data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';

interface SelectRaceProps {
  year: number;
  selectedRound: string;
  onRoundChange: (round: string) => void;
}

// Define interfaces for our race options
interface SpecialRaceOption {
  round: string;
  name: string;
}

interface MeetingRaceOption {
  round: string;
  name: string;
  fullName: string;
}

type RaceOption = SpecialRaceOption | MeetingRaceOption;

export const SelectRace: React.FC<SelectRaceProps> = ({ year, selectedRound, onRoundChange }) => {
  // Get sessions directly from OpenF1 API
  const { data: sessionsData, isLoading } = useSessionsByYear(year);
  
  if (isLoading) {
    return <Skeleton className="h-10 w-[200px]" />;
  }
  
  if (!sessionsData?.data || sessionsData.data.length === 0) {
    return (
      <Select value="1" onValueChange={onRoundChange} disabled>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="No races found" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">No races found</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  
  // Group sessions by meeting_key to get unique race venues
  const meetings = new Map();
  
  sessionsData.data.forEach(session => {
    const key = session.meeting_key.toString();
    
    // Prioritize Race session type for each meeting
    if (session.session_type === "Race") {
      meetings.set(key, session);
    } else if (!meetings.has(key)) {
      meetings.set(key, session);
    }
  });
  
  // Convert to array and sort chronologically
  const meetingsArray = Array.from(meetings.values())
    .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
  
  // Add special options and create race options
  const specialOptions: SpecialRaceOption[] = [
    { round: "last", name: "Latest Race" },
    { round: "next", name: "Next Race" }
  ];
  
  const meetingOptions: MeetingRaceOption[] = meetingsArray.map(meeting => {
    // Format name as "Japanese Grand Prix - Suzuka" (without emoji)
    const name = `${meeting.country_name} Grand Prix`;
    const circuitName = meeting.circuit_short_name;
    
    return {
      round: meeting.meeting_key.toString(),
      name: name,
      fullName: circuitName ? `${name} - ${circuitName}` : name
    };
  });
  
  // Combine the options
  const raceOptions: RaceOption[] = [...specialOptions, ...meetingOptions];
  
  return (
    <Select value={selectedRound} onValueChange={onRoundChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select race" />
      </SelectTrigger>
      <SelectContent>
        {raceOptions.map(race => (
          <SelectItem key={race.round} value={race.round}>
            {'fullName' in race ? race.fullName : race.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}; 