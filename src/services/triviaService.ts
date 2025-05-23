import { supabase } from "@/integrations/supabase/client";
import { TriviaQuestion, TriviaScore, TriviaCategory, TriviaDifficulty, GameMode, GameModeInfo } from "@/types/trivia";
import { v4 as uuidv4 } from "uuid";

const BASE_URL = "https://api.jolpi.ca/ergast";

// Enhanced configuration
const CONFIG = {
  MIN_YEAR: 2005,
  MAX_YEAR: new Date().getFullYear(),
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  MIN_OPTIONS: 4,
  MAX_OPTIONS: 4
};

// Game mode configurations
export const GAME_MODES: Record<GameMode, GameModeInfo> = {
  normal: {
    mode: 'normal',
    title: 'Normal Mode',
    description: 'Classic trivia experience with standard scoring',
    rules: [
      'Answer 15 F1 trivia questions',
      '45 seconds per question',
      'Earn points for correct answers',
      'Time bonus for quick responses',
      'No penalties for wrong answers'
    ],
    difficulty: 'Medium',
    icon: '🏎️'
  },
  destructive: {
    mode: 'destructive',
    title: 'Destructive Mode',
    description: 'High-stakes mode where wrong answers cost you!',
    rules: [
      'Answer 15 F1 trivia questions',
      '45 seconds per question',
      'Every 2 wrong answers removes 1 correct answer',
      'Lost correct answers = lost points',
      'Only for the brave - high risk, high reward!'
    ],
    difficulty: 'Extreme',
    icon: '💥'
  }
};

// Simple cache for API responses
const cache = new Map<string, { data: any; timestamp: number }>();

// Enhanced error types
class TriviaError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TriviaError';
  }
}

// Utility function for API calls with retry and caching
const fetchWithRetry = async (url: string, retries = CONFIG.MAX_RETRIES): Promise<any> => {
  // Check cache first
  const cacheKey = url;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) {
    return cached.data;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new TriviaError(`HTTP ${response.status}: ${response.statusText}`, 'HTTP_ERROR');
      }
      
      const data = await response.json();
      
      // Validate data structure
      if (!data?.MRData) {
        throw new TriviaError('Invalid API response structure', 'INVALID_RESPONSE');
      }
      
      // Cache the response
      cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.warn(`API call attempt ${attempt} failed:`, error);
      
      if (attempt === retries) {
        throw error instanceof TriviaError ? error : new TriviaError(`Failed after ${retries} attempts: ${error.message}`, 'API_FAILURE');
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
    }
  }
};

// Enhanced function to generate random years with better distribution
const getRandomYear = (min = CONFIG.MIN_YEAR, max = CONFIG.MAX_YEAR): number => {
  if (min > max) {
    min = max;
  }
  
  // Weight more recent years slightly higher
  const range = max - min + 1;
  const weights = Array.from({ length: range }, (_, i) => {
    const year = min + i;
    const recency = (year - min) / range;
    return 0.5 + (recency * 0.5); // Weight from 0.5 to 1.0
  });
  
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const random = Math.random() * totalWeight;
  
  let accumulator = 0;
  for (let i = 0; i < weights.length; i++) {
    accumulator += weights[i];
    if (random <= accumulator) {
      return min + i;
    }
  }
  
  return max; // Fallback
};

// Enhanced function to shuffle array with better randomization
const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Validate question quality
const validateQuestion = (question: TriviaQuestion): boolean => {
  if (!question.question || question.question.length < 10) return false;
  if (!question.correctAnswer || question.correctAnswer.trim() === '') return false;
  if (!question.options || question.options.length < CONFIG.MIN_OPTIONS) return false;
  if (!question.options.includes(question.correctAnswer)) return false;
  if (new Set(question.options).size !== question.options.length) return false; // No duplicates
  return true;
};

// Enhanced scoring system based on difficulty and category
const calculatePoints = (category: TriviaCategory, difficulty: TriviaDifficulty, year?: number): number => {
  let basePoints = 10;
  
  // Category multiplier
  const categoryMultipliers = {
    'drivers': 1.0,
    'teams': 1.2,
    'races': 1.1,
    'championships': 1.5,
    'statistics': 1.3
  };
  
  // Difficulty multiplier
  const difficultyMultipliers = {
    'easy': 1.0,
    'medium': 1.2,
    'hard': 1.5
  };
  
  // Year bonus (older years are worth more)
  let yearMultiplier = 1.0;
  if (year) {
    const currentYear = new Date().getFullYear();
    const yearDiff = currentYear - year;
    yearMultiplier = 1.0 + (yearDiff * 0.02); // 2% bonus per year back
  }
  
  return Math.round(basePoints * categoryMultipliers[category] * difficultyMultipliers[difficulty] * yearMultiplier);
};

// Get driver information for a random year
const getRandomDriverQuestion = async (): Promise<TriviaQuestion | null> => {
  try {
    const year = getRandomYear();
    const data = await fetchWithRetry(`${BASE_URL}/f1/${year}/drivers.json`);
    
    const drivers = data.MRData?.DriverTable?.Drivers || [];
    
    if (drivers.length === 0) {
      throw new TriviaError('No drivers found for the selected year', 'NO_DATA');
    }
    
    // Generate a random driver question
    const randomDriver = drivers[Math.floor(Math.random() * drivers.length)];
    const questionTypes = [
      {
        type: "number",
        question: `What was ${randomDriver.givenName} ${randomDriver.familyName}'s permanent number in ${year}?`,
        answer: randomDriver.permanentNumber || "No permanent number",
        difficulty: 'medium' as TriviaDifficulty,
        generate: () => {
          const correctAnswer = randomDriver.permanentNumber || "N/A";
          // Generate 3 random numbers between 1 and 99 (excluding the correct answer)
          const options = new Set([correctAnswer]);
          while (options.size < CONFIG.MAX_OPTIONS) {
            const randomNum = Math.floor(Math.random() * 99) + 1;
            if (randomNum.toString() !== correctAnswer) {
              options.add(randomNum.toString());
            }
          }
          return { correctAnswer, options: Array.from(options) };
        }
      },
      {
        type: "nationality",
        question: `What is the nationality of F1 driver ${randomDriver.givenName} ${randomDriver.familyName}?`,
        answer: randomDriver.nationality,
        difficulty: 'easy' as TriviaDifficulty,
        generate: () => {
          const correctAnswer = randomDriver.nationality;
          // Get random nationalities from other drivers (excluding the correct one)
          const otherNationalities = drivers
            .filter(d => d.nationality !== correctAnswer)
            .map(d => d.nationality);
          const uniqueNationalities = [...new Set(otherNationalities)];
          
          if (uniqueNationalities.length < 3) {
            // Fallback nationalities if not enough unique ones
            const fallbackNationalities = ['British', 'German', 'Italian', 'French', 'Spanish', 'Brazilian', 'American'];
            uniqueNationalities.push(...fallbackNationalities.filter(n => n !== correctAnswer));
          }
          
          const randomOptions = shuffleArray(uniqueNationalities).slice(0, 3);
          const options = shuffleArray([correctAnswer, ...randomOptions]);
          return { correctAnswer, options };
        }
      },
      {
        type: "code",
        question: `What is ${randomDriver.givenName} ${randomDriver.familyName}'s driver code?`,
        answer: randomDriver.code || "Unknown",
        difficulty: 'hard' as TriviaDifficulty,
        generate: () => {
          const correctAnswer = randomDriver.code || "Unknown";
          if (correctAnswer === "Unknown") {
            return { correctAnswer, options: ["Unknown", "N/A", "Not assigned", "No code"] };
          }
          
          // Get random codes from other drivers (excluding the correct one)
          const otherCodes = drivers
            .filter(d => d.code && d.code !== correctAnswer)
            .map(d => d.code);
          
          if (otherCodes.length < 3) {
            // Generate some realistic-looking codes if not enough
            const codeLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            while (otherCodes.length < 3) {
              const randomCode = Array.from({ length: 3 }, () => 
                codeLetters[Math.floor(Math.random() * codeLetters.length)]
              ).join('');
              if (!otherCodes.includes(randomCode) && randomCode !== correctAnswer) {
                otherCodes.push(randomCode);
              }
            }
          }
          
          const randomOptions = shuffleArray(otherCodes).slice(0, 3);
          const options = shuffleArray([correctAnswer, ...randomOptions]);
          return { correctAnswer, options };
        }
      }
    ];
    
    // Choose a random question type
    const questionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
    const { correctAnswer, options } = questionType.generate();
    
    const question: TriviaQuestion = {
      id: uuidv4(),
      question: questionType.question,
      correctAnswer,
      options: shuffleArray(options as string[]),
      category: 'drivers',
      difficulty: questionType.difficulty,
      year,
      points: calculatePoints('drivers', questionType.difficulty, year)
    };
    
    // Validate the question before returning
    if (!validateQuestion(question)) {
      throw new TriviaError('Generated question failed validation', 'INVALID_QUESTION');
    }
    
    return question;
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
      points: calculatePoints('teams', 'medium', year)
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
      points: calculatePoints('races', 'medium', year)
    };
  } catch (error) {
    console.error("Failed to generate race question:", error);
    return null;
  }
};

// Get championship information for a random year
const getRandomChampionshipQuestion = async (): Promise<TriviaQuestion | null> => {
  try {
    const year = getRandomYear(CONFIG.MIN_YEAR, new Date().getFullYear() - 1); // Ensure complete season
    
    // Get driver standings for the championship winner
    const driverStandingsData = await fetchWithRetry(`${BASE_URL}/f1/${year}/driverStandings.json`);
    const driverStandings = driverStandingsData.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
    
    if (driverStandings.length === 0) {
      throw new TriviaError('No driver standings found for the selected year', 'NO_DATA');
    }
    
    const champion = driverStandings[0];
    
    // Get constructor standings for the constructor champion
    let constructorChampion = null;
    
    try {
      const constructorStandingsData = await fetchWithRetry(`${BASE_URL}/f1/${year}/constructorStandings.json`);
      const constructorStandings = constructorStandingsData.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
      if (constructorStandings.length > 0) {
        constructorChampion = constructorStandings[0];
      }
    } catch (error) {
      console.warn("Could not fetch constructor standings for", year);
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
      points: calculatePoints('championships', 'medium', year)
    };
  } catch (error) {
    console.error("Failed to generate championship question:", error);
    return null;
  }
};

// Get statistics and records questions
const getRandomStatisticsQuestion = async (): Promise<TriviaQuestion | null> => {
  try {
    const year = getRandomYear(CONFIG.MIN_YEAR, new Date().getFullYear() - 1);
    
    // Get all races for the year to find statistics
    const racesData = await fetchWithRetry(`${BASE_URL}/f1/${year}.json`);
    const races = racesData.MRData?.RaceTable?.Races || [];
    
    if (races.length === 0) {
      throw new TriviaError('No races found for the selected year', 'NO_DATA');
    }
    
    // Choose a random race
    const randomRace = races[Math.floor(Math.random() * races.length)];
    
    // Get results for the race
    const resultsData = await fetchWithRetry(`${BASE_URL}/f1/${year}/${randomRace.round}/results.json`);
    const results = resultsData.MRData?.RaceTable?.Races?.[0]?.Results || [];
    
    if (results.length === 0) {
      throw new TriviaError('No race results found for the selected race', 'NO_DATA');
    }
    
    // Get qualifying results if available
    let qualifyingResults = [];
    try {
      const qualifyingData = await fetchWithRetry(`${BASE_URL}/f1/${year}/${randomRace.round}/qualifying.json`);
        qualifyingResults = qualifyingData.MRData?.RaceTable?.Races?.[0]?.QualifyingResults || [];
    } catch (error) {
      console.warn("Failed to fetch qualifying results for", year, randomRace.round);
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
      points: calculatePoints('statistics', 'hard', year)
    };
  } catch (error) {
    console.error("Failed to generate statistics question:", error);
    return null;
  }
};

// Enhanced main function to generate a batch of random trivia questions
export const generateTriviaQuestions = async (count: number = 15): Promise<TriviaQuestion[]> => {
  const questions: TriviaQuestion[] = [];
  const generators = [
    { func: getRandomDriverQuestion, category: 'drivers', weight: 2 },
    { func: getRandomTeamQuestion, category: 'teams', weight: 1.5 },
    { func: getRandomRaceQuestion, category: 'races', weight: 2 },
    { func: getRandomChampionshipQuestion, category: 'championships', weight: 1 },
    { func: getRandomStatisticsQuestion, category: 'statistics', weight: 1.2 }
  ];
  
  // Calculate target questions per category based on weights
  const totalWeight = generators.reduce((sum, gen) => sum + gen.weight, 0);
  const targetDistribution = generators.map(gen => ({
    ...gen,
    target: Math.ceil((gen.weight / totalWeight) * count)
  }));
  
  // Track attempts to prevent infinite loops
  const maxAttempts = count * 3;
  let attempts = 0;
  const questionsByCategory = new Map<string, number>();
  
  // Initialize category counts
  generators.forEach(gen => questionsByCategory.set(gen.category, 0));
  
  while (questions.length < count && attempts < maxAttempts) {
    attempts++;
    
    // Select generator based on current distribution needs
    const availableGenerators = targetDistribution.filter(gen => {
      const currentCount = questionsByCategory.get(gen.category) || 0;
      return currentCount < gen.target;
    });
    
    if (availableGenerators.length === 0) {
      // All categories have reached their targets, pick randomly
      const randomGen = generators[Math.floor(Math.random() * generators.length)];
      await tryGenerateQuestion(randomGen.func, randomGen.category);
    } else {
      // Pick from available generators, weighted by remaining need
      const weights = availableGenerators.map(gen => {
        const currentCount = questionsByCategory.get(gen.category) || 0;
        const remaining = gen.target - currentCount;
        return remaining * gen.weight;
      });
      
      const totalAvailableWeight = weights.reduce((sum, weight) => sum + weight, 0);
      const random = Math.random() * totalAvailableWeight;
      
      let accumulator = 0;
      for (let i = 0; i < availableGenerators.length; i++) {
        accumulator += weights[i];
        if (random <= accumulator) {
          const selectedGen = availableGenerators[i];
          await tryGenerateQuestion(selectedGen.func, selectedGen.category);
          break;
        }
      }
    }
  }
  
  async function tryGenerateQuestion(generator: () => Promise<TriviaQuestion | null>, category: string) {
    try {
      const question = await generator();
      if (question && validateQuestion(question)) {
        // Check for duplicate questions
        const isDuplicate = questions.some(q => 
          q.question.toLowerCase() === question.question.toLowerCase() ||
          (q.correctAnswer === question.correctAnswer && q.category === question.category)
        );
        
        if (!isDuplicate) {
          questions.push(question);
          questionsByCategory.set(category, (questionsByCategory.get(category) || 0) + 1);
      }
    }
    } catch (error) {
      console.warn(`Failed to generate ${category} question:`, error);
    }
  }
  
  // If we don't have enough questions, try a few more random attempts
  const finalAttempts = Math.min(10, count - questions.length);
  for (let i = 0; i < finalAttempts && questions.length < count; i++) {
    const randomGenerator = generators[Math.floor(Math.random() * generators.length)];
    await tryGenerateQuestion(randomGenerator.func, randomGenerator.category);
    }
  
  if (questions.length === 0) {
    throw new TriviaError('Unable to generate any questions', 'GENERATION_FAILED');
  }
  
  console.log(`Generated ${questions.length} questions with distribution:`, 
    Object.fromEntries(questionsByCategory));
  
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
      created_at: score.createdAt,
      game_mode: score.gameMode,
      is_public: score.isPublic
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

// Get top scores from Supabase (only public scores)
export const getTopScores = async (limit: number = 10): Promise<TriviaScore[]> => {
  try {
    const { data, error } = await supabase
      .from('trivia_scores')
      .select('*')
      .eq('is_public', true) // Only get public scores
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
      createdAt: record.created_at,
      gameMode: (record.game_mode as GameMode) || 'normal',
      isPublic: record.is_public
    }));
  } catch (error) {
    console.error("Failed to get top scores:", error);
    return [];
  }
};

// Get user's scores from Supabase (both public and private scores)
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
      createdAt: record.created_at,
      gameMode: (record.game_mode as GameMode) || 'normal',
      isPublic: record.is_public
    }));
  } catch (error) {
    console.error("Failed to get user scores:", error);
    return [];
  }
};

// Update the privacy setting of a specific score
export const updateScorePrivacy = async (scoreId: string, isPublic: boolean): Promise<void> => {
  try {
    const { error } = await supabase
      .from('trivia_scores')
      .update({ is_public: isPublic })
      .eq('id', scoreId);
    
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Failed to update score privacy:", error);
    throw error;
  }
}; 