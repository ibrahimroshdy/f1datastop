import { supabase } from "@/integrations/supabase/client";
import { TriviaQuestion, TriviaScore, TriviaCategory, TriviaDifficulty } from "@/types/trivia";
import { v4 as uuidv4 } from "uuid";

const BASE_URL = "https://api.jolpi.ca/ergast";

// Function to generate random years between 2000 and current year
const getRandomYear = (min = 2000, max = new Date().getFullYear()): number => {
  // If min somehow becomes greater than max (e.g., current year is 1999), default to max
  if (min > max) {
    min = max;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Function to shuffle array randomly (Fisher-Yates algorithm)
const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Get driver information for a random year
const getRandomDriverQuestion = async (): Promise<TriviaQuestion | null> => {
  try {
    const year = getRandomYear();
    const response = await fetch(`${BASE_URL}/f1/${year}/drivers.json`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const drivers = data.MRData?.DriverTable?.Drivers || [];
    
    if (drivers.length === 0) {
      return null;
    }
    
    // Generate a random driver question
    const randomDriver = drivers[Math.floor(Math.random() * drivers.length)];
    const questionTypes = [
      {
        type: "number",
        question: `What was ${randomDriver.givenName} ${randomDriver.familyName}'s permanent number in ${year}?`,
        answer: randomDriver.permanentNumber || "No permanent number",
        generate: () => {
          const correctAnswer = randomDriver.permanentNumber || "N/A";
          // Generate 3 random numbers between 1 and 99 (excluding the correct answer)
          const options = new Set([correctAnswer]);
          while (options.size < 4) {
            options.add(Math.floor(Math.random() * 99) + 1 + "");
          }
          return { correctAnswer, options: Array.from(options) };
        }
      },
      {
        type: "nationality",
        question: `What is the nationality of F1 driver ${randomDriver.givenName} ${randomDriver.familyName}?`,
        answer: randomDriver.nationality,
        generate: () => {
          const correctAnswer = randomDriver.nationality;
          // Get random nationalities from other drivers (excluding the correct one)
          const otherNationalities = drivers
            .filter(d => d.nationality !== correctAnswer)
            .map(d => d.nationality);
          const uniqueNationalities = [...new Set(otherNationalities)];
          const randomOptions = shuffleArray(uniqueNationalities).slice(0, 3);
          const options = shuffleArray([correctAnswer, ...randomOptions]);
          return { correctAnswer, options };
        }
      },
      {
        type: "code",
        question: `What is ${randomDriver.givenName} ${randomDriver.familyName}'s driver code?`,
        answer: randomDriver.code || "Unknown",
        generate: () => {
          const correctAnswer = randomDriver.code || "Unknown";
          // Get random codes from other drivers (excluding the correct one)
          const otherCodes = drivers
            .filter(d => d.code && d.code !== correctAnswer)
            .map(d => d.code);
          const randomOptions = shuffleArray(otherCodes).slice(0, 3);
          const options = shuffleArray([correctAnswer, ...randomOptions]);
          return { correctAnswer, options };
        }
      }
    ];
    
    // Choose a random question type
    const questionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
    const { correctAnswer, options } = questionType.generate();
    
    return {
      id: uuidv4(),
      question: questionType.question,
      correctAnswer,
      options: shuffleArray(options as string[]),
      category: 'drivers',
      difficulty: 'medium',
      year,
      points: 10
    };
  } catch (error) {
    console.error("Failed to generate driver question:", error);
    return null;
  }
};

// Get team/constructor information for a random year
const getRandomTeamQuestion = async (): Promise<TriviaQuestion | null> => {
  try {
    const year = getRandomYear();
    const response = await fetch(`${BASE_URL}/f1/${year}/constructors.json`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const constructors = data.MRData?.ConstructorTable?.Constructors || [];
    
    if (constructors.length === 0) {
      return null;
    }
    
    // Get random drivers for constructors
    const driversResponse = await fetch(`${BASE_URL}/f1/${year}/drivers.json`);
    if (!driversResponse.ok) {
      throw new Error(`API request failed with status ${driversResponse.status}`);
    }
    
    const driversData = await driversResponse.json();
    const drivers = driversData.MRData?.DriverTable?.Drivers || [];

    // Get constructor standings to find more information
    const standingsResponse = await fetch(`${BASE_URL}/f1/${year}/constructorStandings.json`);
    let constructorStandings = [];
    
    if (standingsResponse.ok) {
      const standingsData = await standingsResponse.json();
      constructorStandings = standingsData.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
    }
    
    // Generate a random constructor question
    const randomConstructor = constructors[Math.floor(Math.random() * constructors.length)];
    
    // Find drivers for this constructor
    const constructorDriversResponse = await fetch(`${BASE_URL}/f1/${year}/constructors/${randomConstructor.constructorId}/drivers.json`);
    let constructorDrivers = [];
    
    if (constructorDriversResponse.ok) {
      const constructorDriversData = await constructorDriversResponse.json();
      constructorDrivers = constructorDriversData.MRData?.DriverTable?.Drivers || [];
    }
    
    const questionTypes = [
      {
        type: "nationality",
        question: `What is the nationality of F1 team ${randomConstructor.name} in ${year}?`,
        answer: randomConstructor.nationality,
        generate: () => {
          const correctAnswer = randomConstructor.nationality;
          // Get random nationalities from other constructors (excluding the correct one)
          const otherNationalities = constructors
            .filter(c => c.nationality !== correctAnswer)
            .map(c => c.nationality);
          const uniqueNationalities = [...new Set(otherNationalities)];
          const randomOptions = shuffleArray(uniqueNationalities).slice(0, 3);
          const options = shuffleArray([correctAnswer, ...randomOptions]);
          return { correctAnswer, options };
        }
      },
      {
        type: "driver",
        question: `Which driver did NOT race for ${randomConstructor.name} in ${year}?`,
        generate: () => {
          if (constructorDrivers.length === 0 || drivers.length < 4) {
            return { correctAnswer: "Unknown", options: ["Unknown"] };
          }
          
          const teamDriverIds = constructorDrivers.map(d => d.driverId);
          const nonTeamDrivers = drivers.filter(d => !teamDriverIds.includes(d.driverId));
          
          if (nonTeamDrivers.length === 0) {
            return { correctAnswer: "Unknown", options: ["Unknown"] };
          }
          
          const correctAnswer = `${nonTeamDrivers[0].givenName} ${nonTeamDrivers[0].familyName}`;
          const teamDriverOptions = constructorDrivers.slice(0, 3).map(d => `${d.givenName} ${d.familyName}`);
          const options = shuffleArray([correctAnswer, ...teamDriverOptions]);
          
          return { correctAnswer, options };
        }
      }
    ];
    
    // Choose a random question type
    const questionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
    const { correctAnswer, options } = questionType.generate();
    
    return {
      id: uuidv4(),
      question: questionType.question,
      correctAnswer,
      options: options as string[],
      category: 'teams',
      difficulty: 'medium',
      year,
      points: 15
    };
  } catch (error) {
    console.error("Failed to generate team question:", error);
    return null;
  }
};

// Get race information for a random year
const getRandomRaceQuestion = async (): Promise<TriviaQuestion | null> => {
  try {
    const year = getRandomYear();
    const response = await fetch(`${BASE_URL}/f1/${year}.json`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const races = data.MRData?.RaceTable?.Races || [];
    
    if (races.length === 0) {
      return null;
    }
    
    // Choose a random race
    const randomRace = races[Math.floor(Math.random() * races.length)];
    
    // Get results for the race to find the winner
    const resultsResponse = await fetch(`${BASE_URL}/f1/${year}/${randomRace.round}/results.json`);
    let results = [];
    let winner = null;
    
    if (resultsResponse.ok) {
      const resultsData = await resultsResponse.json();
      results = resultsData.MRData?.RaceTable?.Races?.[0]?.Results || [];
      winner = results.length > 0 ? results[0] : null;
    }
    
    const questionTypes = [
      {
        type: "circuit",
        question: `In which circuit was the ${year} ${randomRace.raceName} held?`,
        generate: () => {
          const correctAnswer = randomRace.Circuit.circuitName;
          // Get random circuits from other races (excluding the correct one)
          const otherCircuits = races
            .filter(r => r.Circuit.circuitId !== randomRace.Circuit.circuitId)
            .map(r => r.Circuit.circuitName);
          const uniqueCircuits = [...new Set(otherCircuits)];
          const randomOptions = shuffleArray(uniqueCircuits).slice(0, 3);
          const options = shuffleArray([correctAnswer, ...randomOptions]);
          return { correctAnswer, options };
        }
      },
      {
        type: "winner",
        question: `Who won the ${year} ${randomRace.raceName}?`,
        generate: () => {
          if (!winner) {
            return { correctAnswer: "Unknown", options: ["Unknown"] };
          }
          
          const correctAnswer = `${winner.Driver.givenName} ${winner.Driver.familyName}`;
          
          // Get other drivers from the results
          const otherDrivers = results
            .filter((_, index) => index > 0 && index < 4)
            .map(r => `${r.Driver.givenName} ${r.Driver.familyName}`);
          
          // If we don't have enough drivers, add some generic names
          while (otherDrivers.length < 3) {
            otherDrivers.push(`Driver ${otherDrivers.length + 2}`);
          }
          
          const options = shuffleArray([correctAnswer, ...otherDrivers]);
          return { correctAnswer, options };
        }
      },
      {
        type: "country",
        question: `In which country was the ${year} ${randomRace.raceName} held?`,
        generate: () => {
          const correctAnswer = randomRace.Circuit.Location.country;
          // Get random countries from other races (excluding the correct one)
          const otherCountries = races
            .filter(r => r.Circuit.Location.country !== correctAnswer)
            .map(r => r.Circuit.Location.country);
          const uniqueCountries = [...new Set(otherCountries)];
          const randomOptions = shuffleArray(uniqueCountries).slice(0, 3);
          const options = shuffleArray([correctAnswer, ...randomOptions]);
          return { correctAnswer, options };
        }
      }
    ];
    
    // Choose a random question type
    const questionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
    const { correctAnswer, options } = questionType.generate();
    
    return {
      id: uuidv4(),
      question: questionType.question,
      correctAnswer,
      options: options as string[],
      category: 'races',
      difficulty: 'medium',
      year,
      points: 10
    };
  } catch (error) {
    console.error("Failed to generate race question:", error);
    return null;
  }
};

// Get championship information for a random year
const getRandomChampionshipQuestion = async (): Promise<TriviaQuestion | null> => {
  try {
    const year = getRandomYear(1950, new Date().getFullYear() - 1); // Ensure complete season
    
    // Get driver standings for the championship winner
    const driverStandingsResponse = await fetch(`${BASE_URL}/f1/${year}/driverStandings.json`);
    if (!driverStandingsResponse.ok) {
      throw new Error(`API request failed with status ${driverStandingsResponse.status}`);
    }
    
    const driverStandingsData = await driverStandingsResponse.json();
    const driverStandings = driverStandingsData.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
    
    if (driverStandings.length === 0) {
      return null;
    }
    
    const champion = driverStandings[0];
    
    // Get constructor standings for the constructor champion
    const constructorStandingsResponse = await fetch(`${BASE_URL}/f1/${year}/constructorStandings.json`);
    let constructorChampion = null;
    
    if (constructorStandingsResponse.ok) {
      const constructorStandingsData = await constructorStandingsResponse.json();
      const constructorStandings = constructorStandingsData.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
      if (constructorStandings.length > 0) {
        constructorChampion = constructorStandings[0];
      }
    }
    
    const questionTypes = [
      {
        type: "driver-champion",
        question: `Who was the F1 World Drivers' Champion in ${year}?`,
        generate: () => {
          const correctAnswer = `${champion.Driver.givenName} ${champion.Driver.familyName}`;
          
          // Get other top drivers from the standings
          const otherDrivers = driverStandings
            .filter((_, index) => index > 0 && index < 4)
            .map(d => `${d.Driver.givenName} ${d.Driver.familyName}`);
          
          const options = shuffleArray([correctAnswer, ...otherDrivers]);
          return { correctAnswer, options };
        }
      },
      {
        type: "constructor-champion",
        question: `Which team won the F1 Constructors' Championship in ${year}?`,
        generate: () => {
          if (!constructorChampion) {
            return { correctAnswer: "No constructors' championship", options: ["No constructors' championship"] };
          }
          
          const correctAnswer = constructorChampion.Constructor.name;
          
          // Get other constructors from the standings
          const otherConstructors = driverStandings
            .slice(1, 4)
            .map(d => d.Constructors?.[0]?.name || "Unknown")
            .filter(name => name !== "Unknown" && name !== correctAnswer);
          
          // Ensure we have enough options
          while (otherConstructors.length < 3) {
            otherConstructors.push(`Constructor ${otherConstructors.length + 2}`);
          }
          
          const options = shuffleArray([correctAnswer, ...otherConstructors]);
          return { correctAnswer, options };
        }
      },
      {
        type: "points",
        question: `How many points did the F1 Champion score in ${year}?`,
        generate: () => {
          const correctAnswer = champion.points;
          
          // Generate 3 different point values around the correct answer
          const pointVariations = [
            Math.max(1, Math.round(parseInt(correctAnswer) * 0.8)),
            Math.round(parseInt(correctAnswer) * 1.1),
            Math.round(parseInt(correctAnswer) * 0.9)
          ];
          
          const options = shuffleArray([correctAnswer, ...pointVariations]);
          return { correctAnswer, options: options.map(String) };
        }
      }
    ];
    
    // Choose a random question type
    const questionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
    const { correctAnswer, options } = questionType.generate();
    
    return {
      id: uuidv4(),
      question: questionType.question,
      correctAnswer,
      options: options as string[],
      category: 'championships',
      difficulty: 'medium',
      year,
      points: 20
    };
  } catch (error) {
    console.error("Failed to generate championship question:", error);
    return null;
  }
};

// Get statistics and records questions
const getRandomStatisticsQuestion = async (): Promise<TriviaQuestion | null> => {
  try {
    const year = getRandomYear(1950, new Date().getFullYear() - 1);
    
    // Get all races for the year to find statistics
    const racesResponse = await fetch(`${BASE_URL}/f1/${year}.json`);
    if (!racesResponse.ok) {
      throw new Error(`API request failed with status ${racesResponse.status}`);
    }
    
    const racesData = await racesResponse.json();
    const races = racesData.MRData?.RaceTable?.Races || [];
    
    if (races.length === 0) {
      return null;
    }
    
    // Choose a random race
    const randomRace = races[Math.floor(Math.random() * races.length)];
    
    // Get results for the race
    const resultsResponse = await fetch(`${BASE_URL}/f1/${year}/${randomRace.round}/results.json`);
    if (!resultsResponse.ok) {
      throw new Error(`API request failed with status ${resultsResponse.status}`);
    }
    
    const resultsData = await resultsResponse.json();
    const results = resultsData.MRData?.RaceTable?.Races?.[0]?.Results || [];
    
    if (results.length === 0) {
      return null;
    }
    
    // Get qualifying results if available
    let qualifyingResults = [];
    try {
      const qualifyingResponse = await fetch(`${BASE_URL}/f1/${year}/${randomRace.round}/qualifying.json`);
      if (qualifyingResponse.ok) {
        const qualifyingData = await qualifyingResponse.json();
        qualifyingResults = qualifyingData.MRData?.RaceTable?.Races?.[0]?.QualifyingResults || [];
      }
    } catch (error) {
      console.error("Failed to fetch qualifying results:", error);
    }
    
    const questionTypes = [
      {
        type: "fastest-lap",
        question: `Who set the fastest lap in the ${year} ${randomRace.raceName}?`,
        generate: () => {
          // Find driver with fastest lap
          const fastestLapDriver = results.find(r => r.FastestLap?.rank === "1");
          
          if (!fastestLapDriver) {
            return { correctAnswer: "Data not available", options: ["Data not available"] };
          }
          
          const correctAnswer = `${fastestLapDriver.Driver.givenName} ${fastestLapDriver.Driver.familyName}`;
          
          // Get other random drivers from the results
          const otherDrivers = results
            .filter(r => r.Driver.driverId !== fastestLapDriver.Driver.driverId)
            .map(r => `${r.Driver.givenName} ${r.Driver.familyName}`);
          
          const randomOptions = shuffleArray(otherDrivers).slice(0, 3);
          const options = shuffleArray([correctAnswer, ...randomOptions]);
          
          return { correctAnswer, options };
        }
      },
      {
        type: "pole-position",
        question: `Who secured pole position for the ${year} ${randomRace.raceName}?`,
        generate: () => {
          if (qualifyingResults.length === 0) {
            return { correctAnswer: "Data not available", options: ["Data not available"] };
          }
          
          const polePositionDriver = qualifyingResults[0];
          const correctAnswer = `${polePositionDriver.Driver.givenName} ${polePositionDriver.Driver.familyName}`;
          
          // Get other drivers from qualifying
          const otherDrivers = qualifyingResults
            .filter((_, index) => index > 0)
            .map(q => `${q.Driver.givenName} ${q.Driver.familyName}`);
          
          const randomOptions = shuffleArray(otherDrivers).slice(0, 3);
          const options = shuffleArray([correctAnswer, ...randomOptions]);
          
          return { correctAnswer, options };
        }
      },
      {
        type: "podium",
        question: `Which driver did NOT finish on the podium in the ${year} ${randomRace.raceName}?`,
        generate: () => {
          if (results.length < 4) {
            return { correctAnswer: "Data not available", options: ["Data not available"] };
          }
          
          // Get podium drivers (positions 1-3)
          const podiumDrivers = results.slice(0, 3).map(r => r.Driver.driverId);
          
          // Get a driver who didn't finish on podium
          const nonPodiumDriver = results.find(r => !podiumDrivers.includes(r.Driver.driverId));
          
          if (!nonPodiumDriver) {
            return { correctAnswer: "Data not available", options: ["Data not available"] };
          }
          
          const correctAnswer = `${nonPodiumDriver.Driver.givenName} ${nonPodiumDriver.Driver.familyName}`;
          
          // Get the three podium drivers as incorrect options
          const incorrectOptions = results
            .slice(0, 3)
            .map(r => `${r.Driver.givenName} ${r.Driver.familyName}`);
          
          const options = shuffleArray([correctAnswer, ...incorrectOptions]);
          
          return { correctAnswer, options };
        }
      }
    ];
    
    // Choose a random question type
    const questionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
    const { correctAnswer, options } = questionType.generate();
    
    return {
      id: uuidv4(),
      question: questionType.question,
      correctAnswer,
      options: options as string[],
      category: 'statistics',
      difficulty: 'hard',
      year,
      points: 15
    };
  } catch (error) {
    console.error("Failed to generate statistics question:", error);
    return null;
  }
};

// Main function to generate a batch of random trivia questions
export const generateTriviaQuestions = async (count: number = 15): Promise<TriviaQuestion[]> => {
  const questions: TriviaQuestion[] = [];
  const generators = [
    getRandomDriverQuestion,
    getRandomTeamQuestion,
    getRandomRaceQuestion,
    getRandomChampionshipQuestion,
    getRandomStatisticsQuestion
  ];
  
  // Ensure we have a good mix of different question types
  const questionsPerCategory = Math.ceil(count / generators.length);
  
  for (const generator of generators) {
    for (let i = 0; i < questionsPerCategory; i++) {
      let question = await generator();
      if (question) {
        // Make sure we don't have duplicate questions
        if (!questions.some(q => q.question === question!.question)) {
          questions.push(question);
        }
      }
      
      // Break if we have enough questions
      if (questions.length >= count) {
        break;
      }
    }
    
    // Break if we have enough questions
    if (questions.length >= count) {
      break;
    }
  }
  
  // If we still need more questions, try again with random generators
  while (questions.length < count) {
    const randomGenerator = generators[Math.floor(Math.random() * generators.length)];
    const question = await randomGenerator();
    if (question && !questions.some(q => q.question === question.question)) {
      questions.push(question);
    }
  }
  
  return shuffleArray(questions).slice(0, count);
};

// Save score to Supabase
export const saveScore = async (score: TriviaScore): Promise<void> => {
  try {
    // Convert the score object to match the database column names
    const dbScore = {
      user_id: score.userId,
      username: score.username,
      score: score.score,
      correct_answers: score.correctAnswers,
      total_questions: score.totalQuestions,
      time_spent: score.timeSpent,
      created_at: score.createdAt
    };
    
    const { error } = await supabase.from('trivia_scores').insert(dbScore);
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Failed to save score:", error);
    throw error;
  }
};

// Get top scores from Supabase
export const getTopScores = async (limit: number = 10): Promise<TriviaScore[]> => {
  try {
    const { data, error } = await supabase
      .from('trivia_scores')
      .select('*')
      .order('score', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw error;
    }
    
    // Convert the database records to TriviaScore objects
    return (data || []).map(record => ({
      id: record.id,
      userId: record.user_id,
      username: record.username,
      score: record.score,
      correctAnswers: record.correct_answers,
      totalQuestions: record.total_questions,
      timeSpent: record.time_spent,
      createdAt: record.created_at
    }));
  } catch (error) {
    console.error("Failed to get top scores:", error);
    return [];
  }
};

// Get user's scores from Supabase
export const getUserScores = async (userId: string, limit: number = 10): Promise<TriviaScore[]> => {
  try {
    const { data, error } = await supabase
      .from('trivia_scores')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw error;
    }
    
    // Convert the database records to TriviaScore objects
    return (data || []).map(record => ({
      id: record.id,
      userId: record.user_id,
      username: record.username,
      score: record.score,
      correctAnswers: record.correct_answers,
      totalQuestions: record.total_questions,
      timeSpent: record.time_spent,
      createdAt: record.created_at
    }));
  } catch (error) {
    console.error("Failed to get user scores:", error);
    return [];
  }
}; 