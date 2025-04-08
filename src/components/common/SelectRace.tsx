import React from 'react';
import { useRaceSchedule } from '@/hooks/useF1Data';
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

export const SelectRace: React.FC<SelectRaceProps> = ({ year, selectedRound, onRoundChange }) => {
  const { data: scheduleData, isLoading } = useRaceSchedule(year);
  
  if (isLoading) {
    return <Skeleton className="h-10 w-[160px]" />;
  }
  
  if (!scheduleData?.data || scheduleData.data.length === 0) {
    return (
      <Select value="1" onValueChange={onRoundChange} disabled>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="No races found" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">No races found</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  
  const races = scheduleData.data;
  
  // Add special options and sort races by round number
  const raceOptions = [
    { round: "last", name: "Latest Race" },
    { round: "next", name: "Next Race" },
    ...races.map(race => ({
      round: race.round,
      name: race.raceName
    }))
  ];
  
  return (
    <Select value={selectedRound} onValueChange={onRoundChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder="Select race" />
      </SelectTrigger>
      <SelectContent>
        {raceOptions.map(race => (
          <SelectItem key={race.round} value={race.round}>
            {race.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}; 