import { format } from "date-fns";

export interface SessionInfo {
  name: string;
  shortName: string;
  date: string;
  time: string;
  dateTime: Date;
}

export interface NextSessionResult {
  session: SessionInfo | null;
  raceName: string;
  country: string;
}

/**
 * Determines the next upcoming session (Practice, Qualifying, Sprint, or Race)
 * from a race weekend based on current time
 */
export const getNextSession = (race: any): NextSessionResult => {
  if (!race) {
    return { session: null, raceName: "", country: "" };
  }

  const now = new Date();
  const sessions: SessionInfo[] = [];

  // Add all available sessions to the array
  if (race.FirstPractice?.date) {
    const sessionDate = new Date(race.FirstPractice.date + "T" + (race.FirstPractice.time || "00:00:00Z"));
    sessions.push({
      name: "Practice 1",
      shortName: "FP1",
      date: race.FirstPractice.date,
      time: race.FirstPractice.time || "00:00:00",
      dateTime: sessionDate
    });
  }

  if (race.SecondPractice?.date) {
    const sessionDate = new Date(race.SecondPractice.date + "T" + (race.SecondPractice.time || "00:00:00Z"));
    sessions.push({
      name: "Practice 2",
      shortName: "FP2",
      date: race.SecondPractice.date,
      time: race.SecondPractice.time || "00:00:00",
      dateTime: sessionDate
    });
  }

  if (race.SprintQualifying?.date) {
    const sessionDate = new Date(race.SprintQualifying.date + "T" + (race.SprintQualifying.time || "00:00:00Z"));
    sessions.push({
      name: "Sprint Qualifying",
      shortName: "SQ",
      date: race.SprintQualifying.date,
      time: race.SprintQualifying.time || "00:00:00",
      dateTime: sessionDate
    });
  }

  if (race.ThirdPractice?.date) {
    const sessionDate = new Date(race.ThirdPractice.date + "T" + (race.ThirdPractice.time || "00:00:00Z"));
    sessions.push({
      name: "Practice 3",
      shortName: "FP3",
      date: race.ThirdPractice.date,
      time: race.ThirdPractice.time || "00:00:00",
      dateTime: sessionDate
    });
  }

  if (race.Qualifying?.date) {
    const sessionDate = new Date(race.Qualifying.date + "T" + (race.Qualifying.time || "00:00:00Z"));
    sessions.push({
      name: "Qualifying",
      shortName: "Q",
      date: race.Qualifying.date,
      time: race.Qualifying.time || "00:00:00",
      dateTime: sessionDate
    });
  }

  if (race.Sprint?.date) {
    const sessionDate = new Date(race.Sprint.date + "T" + (race.Sprint.time || "00:00:00Z"));
    sessions.push({
      name: "Sprint Race",
      shortName: "Sprint",
      date: race.Sprint.date,
      time: race.Sprint.time || "00:00:00",
      dateTime: sessionDate
    });
  }

  // Always add the main race
  if (race.date) {
    const sessionDate = new Date(race.date + "T" + (race.time || "00:00:00Z"));
    sessions.push({
      name: "Race",
      shortName: "Race",
      date: race.date,
      time: race.time || "00:00:00",
      dateTime: sessionDate
    });
  }

  // Sort sessions by date/time
  sessions.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

  // Find the next upcoming session
  const nextSession = sessions.find(session => session.dateTime > now);

  return {
    session: nextSession || null,
    raceName: race.raceName || "",
    country: race.Circuit?.Location?.country || ""
  };
};

/**
 * Format date and time for display
 */
export const formatSessionDateTime = (date: string, time: string): string => {
  try {
    const sessionDate = new Date(date + "T" + (time || "00:00:00Z"));
    return format(sessionDate, 'EEE, MMM d, yyyy - HH:mm');
  } catch (error) {
    console.error("Error parsing session date:", error);
    return "Date unavailable";
  }
};