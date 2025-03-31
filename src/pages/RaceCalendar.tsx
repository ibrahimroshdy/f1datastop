
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const RaceCalendar = () => {
  const { data: raceSchedule, isLoading } = useRaceSchedule();
  const currentDate = new Date();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  // Calculate total pages
  const totalRaces = raceSchedule?.data?.length || 0;
  const totalPages = Math.ceil(totalRaces / itemsPerPage);
  
  // Get current page data
  const getCurrentPageData = () => {
    if (!raceSchedule?.data) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return raceSchedule.data.slice(startIndex, endIndex);
  };
  
  const currentRaces = getCurrentPageData();
  
  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  // Generate pagination items
  const renderPaginationItems = () => {
    const items = [];
    
    // Always show first page
    items.push(
      <PaginationItem key="first">
        <PaginationLink 
          isActive={currentPage === 1} 
          onClick={() => handlePageChange(1)}
        >
          1
        </PaginationLink>
      </PaginationItem>
    );
    
    // Show ellipsis if not showing second page
    if (currentPage > 3) {
      items.push(
        <PaginationItem key="ellipsis-1">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }
    
    // Show current page and neighbors
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (i === 1 || i === totalPages) continue; // Skip first and last pages as they're always shown
      items.push(
        <PaginationItem key={i}>
          <PaginationLink 
            isActive={currentPage === i} 
            onClick={() => handlePageChange(i)}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }
    
    // Show ellipsis if not showing second-to-last page
    if (currentPage < totalPages - 2) {
      items.push(
        <PaginationItem key="ellipsis-2">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }
    
    // Always show last page if there's more than 1 page
    if (totalPages > 1) {
      items.push(
        <PaginationItem key="last">
          <PaginationLink 
            isActive={currentPage === totalPages} 
            onClick={() => handlePageChange(totalPages)}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }
    
    return items;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold">Race Calendar {new Date().getFullYear()}</h1>
          <p className="text-muted-foreground">Formula 1 race schedule for the current season</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Race Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Round</TableHead>
                  <TableHead>Grand Prix</TableHead>
                  <TableHead>Circuit</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(itemsPerPage).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-6 w-6" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  currentRaces.map((race: any) => {
                    const raceDate = parseISO(race.date);
                    const isPast = raceDate < currentDate;
                    const isNext = !isPast && raceDate > currentDate && 
                      raceSchedule.data.findIndex((r: any) => 
                        parseISO(r.date) > currentDate && parseISO(r.date) < raceDate
                      ) === -1;
                    
                    return (
                      <TableRow key={race.round} className={isNext ? "bg-f1-dark border-f1-red border-l-2" : ""}>
                        <TableCell className="font-medium">{race.round}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{race.raceName}</span>
                            <span className="text-xs text-muted-foreground">{race.Circuit.Location.country}</span>
                          </div>
                        </TableCell>
                        <TableCell>{race.Circuit.circuitName}</TableCell>
                        <TableCell>{format(parseISO(race.date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          {isPast ? (
                            <Badge variant="outline" className="bg-gray-800">Completed</Badge>
                          ) : isNext ? (
                            <Badge className="bg-f1-red">Next Race</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-800">Upcoming</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            
            {!isLoading && totalPages > 1 && (
              <div className="mt-6">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)} 
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} 
                      />
                    </PaginationItem>
                    
                    {renderPaginationItems()}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)} 
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} 
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default RaceCalendar;
