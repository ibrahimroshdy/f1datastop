import { useState, useEffect, useMemo } from "react";
import { useRaceResults, useLapTimes } from "@/hooks/useF1Data";
import { toast } from "sonner";
import {
  buildPositionChartData,
  getPositionChangeSummary,
  mapErgastResultsToDrivers,
  type PositionChangeSummary,
  type PositionDriver,
} from "@/lib/f1/positionChanges";

export type { PositionChangeSummary, PositionDriver as Driver } from "@/lib/f1/positionChanges";

export const usePositionChangeData = (year: number, round: string) => {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<PositionDriver[]>([]);
  const [totalLaps, setTotalLaps] = useState<number>(0);
  const [isProcessingData, setIsProcessingData] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: raceResultsData,
    isLoading: isResultsLoading,
    error: resultsError,
  } = useRaceResults(year, round);

  const {
    data: lapTimesData,
    isLoading: isLapTimesLoading,
    error: lapTimesError,
    refetch: refetchLapTimes,
    isError,
    failureCount,
  } = useLapTimes(year, round, false);

  const isLoading = isResultsLoading || isLapTimesLoading || isProcessingData;
  const error = resultsError || lapTimesError;

  useEffect(() => {
    if (isError && retryCount < 15) {
      const delaySeconds = Math.min(5 * 2 ** retryCount, 60);
      setLoadingProgress(parseFloat((retryCount * 7).toFixed(2)));
      setErrorMessage(
        `Rate limit exceeded (429). Automatic retry ${retryCount + 1}/15 in ${delaySeconds} seconds...`,
      );

      const timer = setTimeout(() => {
        toast.info(`Retrying position data... Attempt ${retryCount + 1}/15`, {
          id: `position-retry-${retryCount}`,
          duration: 3000,
        });
        setRetryCount((prev) => prev + 1);
        refetchLapTimes();
      }, delaySeconds * 1000);

      return () => clearTimeout(timer);
    }
    if (!isError && !isLoading) {
      setErrorMessage(null);
      setLoadingProgress(100.0);
    }
  }, [isError, retryCount, refetchLapTimes, failureCount, isLoading]);

  useEffect(() => {
    if (raceResultsData?.data?.Results?.length) {
      const drivers = mapErgastResultsToDrivers(raceResultsData.data.Results);
      setAvailableDrivers(drivers);

      if (drivers.length > 0) {
        const winner = drivers.find((d) => d.finishPosition === 1);
        setSelectedDrivers([winner?.code ?? drivers[0].code]);
      }
    }
  }, [raceResultsData]);

  useEffect(() => {
    if (lapTimesData?.data?.Races?.[0]?.Laps) {
      setIsProcessingData(true);
      setTimeout(() => {
        setTotalLaps(lapTimesData.data.Races[0].Laps.length);
        setIsProcessingData(false);
      }, 0);
    }
  }, [lapTimesData]);

  const handleDriverToggle = (driverCode: string) => {
    setSelectedDrivers((prev) =>
      prev.includes(driverCode)
        ? prev.filter((d) => d !== driverCode)
        : [...prev, driverCode],
    );
  };

  const handleDriverHover = (driverCode: string | null) => {
    setHoveredDriver(driverCode);
  };

  const visibleDrivers = useMemo(() => selectedDrivers, [selectedDrivers]);

  const chartData = useMemo(
    () => buildPositionChartData(lapTimesData, availableDrivers),
    [lapTimesData, availableDrivers],
  );

  const getPositionChangeSummaryForDriver = (driverCode: string): PositionChangeSummary | null => {
    const driver = availableDrivers.find((d) => d.code === driverCode);
    if (!driver) return null;
    return getPositionChangeSummary(driverCode, driver, chartData);
  };

  const maxLap =
    chartData.length > 0 ? Math.max(...chartData.map((lap) => lap.lap)) : totalLaps;

  return {
    chartData,
    availableDrivers,
    selectedDrivers,
    hoveredDriver,
    visibleDrivers,
    isLoading,
    isProcessingData,
    isError,
    error,
    retryCount,
    loadingProgress,
    errorMessage,
    totalLaps,
    maxLap,
    handleDriverToggle,
    handleDriverHover,
    getPositionChangeSummary: getPositionChangeSummaryForDriver,
  };
};
