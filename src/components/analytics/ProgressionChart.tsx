import { useEffect, useState, useRef, useMemo, useCallback, useLayoutEffect } from "react";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal, SankeyNode, SankeyLink } from "d3-sankey";
import { useQualifyingToRaceDataByRound } from "@/hooks/useF1Data";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SankeyNodeExtended extends SankeyNode<any, any> {
  name: string;
  team: string;
  position: number;
  type: 'qualifying' | 'grid' | 'race';
  teamName: string;
  fullName: string;
  status?: string;
  isDNF?: boolean;
}

interface SankeyLinkExtended extends Omit<SankeyLink<any, any>, 'source' | 'target'> {
  value: number;
  code: string;
  name: string;
  fullName: string;
  team: string;
  teamName: string;
  qualifyingPosition: number;
  gridPosition: number;
  racePosition: number;
  positionChange: number;
  source: SankeyNodeExtended;
  target: SankeyNodeExtended;
  status?: string;
  isDNF?: boolean;
}

interface ProgressionChartProps {
  year: number;
  round: string;
}

const ProgressionChart = ({ year, round }: ProgressionChartProps) => {
  const { data, isLoading, error, refetch } = useQualifyingToRaceDataByRound(year, round);
  const sankeyRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isRetrying, setIsRetrying] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Handle retry
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await refetch();
    setIsRetrying(false);
  }, [refetch]);
  
  // Immediate dimensions calculation on mount using useLayoutEffect
  useLayoutEffect(() => {
    if (sankeyRef.current) {
      const { width } = sankeyRef.current.getBoundingClientRect();
      if (width > 0) {
        setDimensions({
          width: width,
          height: Math.max(400, Math.min(600, width * 0.8)) // Responsive height
        });
        setHasInitialized(true);
      }
    }
  }, []);
  
  // Update dimensions when window resizes - with debounce
  useEffect(() => {
    let timeoutId: number;
    
    const updateDimensions = () => {
      if (sankeyRef.current) {
        clearTimeout(timeoutId);
        
        timeoutId = window.setTimeout(() => {
          const { width } = sankeyRef.current.getBoundingClientRect();
          if (width > 0) {
            // Use consistent height ratio across all screen sizes
            const heightRatio = 0.7;
            
            setDimensions({
              width: width,
              height: Math.max(350, Math.min(500, width * heightRatio))
            });
            setHasInitialized(true);
          }
        }, 100);
      }
    };
    
    // Run once immediately to ensure the chart is drawn on initial render
    updateDimensions();
    
    window.addEventListener('resize', updateDimensions);
    
    // Ensure we have proper dimensions - additional check after the component has mounted
    if (!hasInitialized && sankeyRef.current) {
      const checkDimensions = () => {
        const { width } = sankeyRef.current!.getBoundingClientRect();
        if (width > 0 && dimensions.width === 0) {
          // Use consistent height ratio across all screen sizes
          const heightRatio = 0.7;
          
          setDimensions({
            width: width,
            height: Math.max(350, Math.min(500, width * heightRatio))
          });
          setHasInitialized(true);
        } else if (!hasInitialized) {
          requestAnimationFrame(checkDimensions);
        }
      };
      
      // Start checking for dimensions
      requestAnimationFrame(checkDimensions);
    }
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(timeoutId);
    };
  }, [dimensions.width, hasInitialized]);
  
  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Run on mount
    checkMobile();
    
    // Add listener
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Memoize the tooltip creation to prevent re-renders
  const createTooltip = useCallback(() => {
    if (!sankeyRef.current) return null;
    
    // Remove existing tooltip
    d3.select(sankeyRef.current).select(".tooltip").remove();
    
    // Create tooltip
    return d3.select(sankeyRef.current)
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "hsl(var(--card))")
      .style("border", "1px solid hsl(var(--border))")
      .style("border-radius", "4px")
      .style("padding", "8px")
      .style("font-size", "12px")
      .style("max-width", "200px")
      .style("box-shadow", "0 3px 10px rgba(0, 0, 0, 0.3)")
      .style("z-index", "10")
      .style("opacity", "0.98")
      .style("backdrop-filter", "blur(4px)")
      .style("color", "hsl(var(--foreground))")
      .style("pointer-events", "none")
      .style("transition", "opacity 0.15s ease-in-out");
  }, []);
  
  // Memoize the sankey generator to prevent recreation
  const createSankeyGenerator = useMemo(() => {
    return (width: number, height: number) => {
      return sankey<SankeyNodeExtended, SankeyLinkExtended>()
        .nodeId((d: any) => d.id)
        .nodeWidth(15)
        .nodePadding(8)
        .extent([[0, 0], [width, height]])
        .nodeSort((a, b) => {
          // Sort qualifying nodes by position
          if (a.type === "qualifying" && b.type === "qualifying") {
            return a.position - b.position;
          }
          // Sort grid nodes by position
          if (a.type === "grid" && b.type === "grid") {
            return a.position - b.position;
          }
          // Sort race nodes by position
          if (a.type === "race" && b.type === "race") {
            return a.position - b.position;  
          }
          // Keep qualifying nodes on left, grid in middle, race nodes on right
          if (a.type === "qualifying") return -1;
          if (b.type === "qualifying") return 1;
          if (a.type === "grid") return -1;
          if (b.type === "grid") return 1;
          return 0;
        });
    };
  }, []);
  
  // Create memoized link mouse event handlers
  const linkMouseHandlers = useCallback((tooltip: any) => {
    return {
      onMouseOver: function(event: MouseEvent, d: SankeyLinkExtended) {
        // Enhance the path appearance
        d3.select(this as SVGPathElement)
          .attr("opacity", 0.9)
          .attr("stroke-width", () => Math.max(3, (d.width || 1) * 1.5))
          .style("filter", "drop-shadow(0px 1px 2px rgba(0,0,0,0.2))");
        
        // Display tooltip with grid information
        const isQualiToGrid = d.source.type === "qualifying" && d.target.type === "grid";
        const isGridToRace = d.source.type === "grid" && d.target.type === "race";
        
        let positionChangeText = "";
        let positionChangeClass = "";
        
        if (isQualiToGrid) {
          const positionChange = d.qualifyingPosition - d.gridPosition;
          positionChangeText = positionChange > 0 
            ? `+${positionChange} positions` 
            : positionChange < 0 
              ? `${positionChange} positions` 
              : `No change`;
          positionChangeClass = positionChange > 0 
            ? "text-red-500" 
            : positionChange < 0 
              ? "text-emerald-500" 
              : "text-blue-500";
        } else if (isGridToRace) {
          const positionChange = d.gridPosition - d.racePosition;
          positionChangeText = positionChange > 0 
            ? `+${positionChange} positions` 
            : positionChange < 0 
              ? `${positionChange} positions` 
              : `No change`;
          positionChangeClass = positionChange > 0 
            ? "text-emerald-500" 
            : positionChange < 0 
              ? "text-red-500" 
              : "text-blue-500";
        }
        
        // Check if the driver retired or DNF
        const statusHTML = d.isDNF 
          ? `<div class="mt-1 pt-1 border-t border-muted text-xs text-red-500 font-medium">${d.status}</div>` 
          : '';
        
        tooltip
          .style("visibility", "visible")
          .style("opacity", 1)
          .html(`
            <div>
              <div class="font-bold text-sm mb-1">${d.fullName || d.name}</div>
              <div class="text-xs text-muted-foreground mb-2">${d.teamName}</div>
              <div class="grid grid-cols-2 gap-x-2 text-xs">
                ${isQualiToGrid ? `
                  <div>Qualifying:</div>
                  <div class="font-mono font-medium">P${d.qualifyingPosition}</div>
                  <div>Grid:</div>
                  <div class="font-mono font-medium">P${d.gridPosition}</div>
                ` : `
                  <div>Grid:</div>
                  <div class="font-mono font-medium">P${d.gridPosition}</div>
                  <div>Race:</div>
                  <div class="font-mono font-medium">P${d.racePosition}</div>
                `}
                <div>Change:</div>
                <div class="font-mono font-medium ${positionChangeClass}">${positionChangeText}</div>
              </div>
              ${statusHTML}
            </div>
          `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      },
      onMouseMove: function(event: MouseEvent) {
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      },
      onMouseOut: function() {
        d3.select(this as SVGPathElement)
          .attr("opacity", 0.5)
          .attr("stroke-width", (d: any) => Math.max(1, d.width || 1))
          .style("filter", "none"); // Remove shadow effect
          
        tooltip.style("visibility", "hidden").style("opacity", 0);
      }
    };
  }, []);
  
  // Create memoized node mouse event handlers
  const nodeMouseHandlers = useCallback((tooltip: any) => {
    return {
      onMouseOver: function(event: MouseEvent, d: SankeyNodeExtended) {
        // Add highlight effect with subtle outline
        d3.select(this as SVGRectElement)
          .attr("opacity", 1)
          .attr("stroke", "currentColor")
          .attr("stroke-width", 1.5);
        
        // Add glow effect with filter - using parent node selection properly
        const parentNode = (this as SVGRectElement).parentElement;
        if (parentNode) {
          d3.select(parentNode)
            .insert("rect", ":first-child")
            .attr("class", "hover-glow")
            .attr("x", (d.x0 || 0) - 2)
            .attr("y", (d.y0 || 0) - 2)
            .attr("height", Math.max(1, (d.y1 || 0) - (d.y0 || 0)) + 4)
            .attr("width", ((d.x1 || 0) - (d.x0 || 0)) + 4)
            .attr("fill", "currentColor")
            .attr("opacity", 0.05)
            .attr("rx", 5)
            .attr("ry", 5);
        }
        
        // Check if the driver retired or DNF (only for race nodes)
        const statusHTML = (d.type === 'race' && d.isDNF) 
          ? `<div class="mt-1 pt-1 border-t border-muted text-xs text-red-500 font-medium">${d.status}</div>` 
          : '';
        
        // Show tooltip for node
        tooltip
          .style("visibility", "visible")
          .style("opacity", 1)
          .html(`
            <div>
              <div class="font-bold text-sm mb-1">${d.fullName}</div>
              <div class="text-xs text-muted-foreground mb-2">${d.teamName}</div>
              <div class="grid grid-cols-2 gap-x-2 text-xs">
                <div>${d.type === 'qualifying' ? 'Qualifying' : d.type === 'grid' ? 'Grid' : 'Race'} Position:</div>
                <div class="font-mono font-medium">P${d.position}</div>
              </div>
              ${statusHTML}
            </div>
          `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      },
      onMouseMove: function(event: MouseEvent) {
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      },
      onMouseOut: function() {
        d3.select(this as SVGRectElement)
          .attr("opacity", 0.85)
          .attr("stroke", "none");
        
        // Remove the glow effect - handling parent node correctly
        const parentNode = (this as SVGRectElement).parentElement;
        if (parentNode) {
          d3.select(parentNode).selectAll(".hover-glow").remove();
        }
        
        tooltip.style("visibility", "hidden").style("opacity", 0);
      }
    };
  }, []);
  
  // Optimize chart drawing by memoizing parts and only updating when needed
  const drawChart = useCallback(() => {
    if (!data?.processedData || dimensions.width <= 0 || !sankeyRef.current) {
      return;
    }
    
    // Clear previous chart by removing only chart elements, not tooltip
    if (svgRef.current) {
      d3.select(svgRef.current).remove();
    }
    
    const { nodes, links } = data.processedData;
    
    // Create tooltip once
    const tooltip = createTooltip();
    if (!tooltip) return;
    
    // Create SVG
    const svg = d3.select(sankeyRef.current)
      .append("svg")
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .append("g");
    
    // Save reference to the SVG element
    svgRef.current = d3.select(sankeyRef.current).select("svg").node() as SVGSVGElement;
    
    // Use the same generous margins for all screen sizes
    const margin = { top: 24, right: 100, bottom: 20, left: 100 };
    
    // Calculate available width for the chart
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom - 20;
    
    // Create chart area with margins
    const chartArea = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // Sort nodes for proper axis ordering
    const qualifyingNodes = nodes.filter(n => n.type === "qualifying")
      .sort((a, b) => a.position - b.position);
    
    const gridNodes = nodes.filter(n => n.type === "grid")
      .sort((a, b) => a.position - b.position);
    
    const raceNodes = nodes.filter(n => n.type === "race")
      .sort((a, b) => a.position - b.position);
      
    // Combine sorted nodes
    const sortedNodes = [...qualifyingNodes, ...gridNodes, ...raceNodes];
    
    // Create Sankey generator with adjusted width
    const sankeyGenerator = createSankeyGenerator(width, height);
    
    // Generate layout
    const sankeyData = sankeyGenerator({
      nodes: sortedNodes as SankeyNodeExtended[],
      links: links as SankeyLinkExtended[]
    });
    
    // Get mouse handlers
    const linkEvents = linkMouseHandlers(tooltip);
    const nodeEvents = nodeMouseHandlers(tooltip);
    
    // Draw links
    chartArea.append("g")
      .selectAll("path")
      .data(sankeyData.links)
      .join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", (d) => {
        // First get the team color for the base
        const teamName = d.source.team;
        let normalizedTeam = teamName.toLowerCase();
        if (normalizedTeam === "alphatauri") normalizedTeam = "rb";
        if (normalizedTeam === "alfa") normalizedTeam = "sauber";
        const teamColor = TEAM_COLORS[normalizedTeam] || "#666666";
        
        // Then color by position change based on link type
        const isQualiToGrid = d.source.type === "qualifying" && d.target.type === "grid";
        const isGridToRace = d.source.type === "grid" && d.target.type === "race";
        
        if (isQualiToGrid) {
          // Qualifying to Grid: penalties/promotions
          if (d.qualifyingPosition < d.gridPosition) {
            // Lost positions (penalty)
            return "#ef4444"; // red-500
          } else if (d.qualifyingPosition > d.gridPosition) {
            // Gained positions (promotion)
            return "#10b981"; // emerald-500
          } else {
            // Maintained position
            return "#3b82f6"; // blue-500
          }
        } else if (isGridToRace) {
          // Grid to Race: race performance
          if (d.gridPosition < d.racePosition) {
            // Lost positions (worse in race)
            return "#ef4444"; // red-500
          } else if (d.gridPosition > d.racePosition) {
            // Gained positions (better in race)
            return "#10b981"; // emerald-500
          } else {
            // Maintained position
            return "#3b82f6"; // blue-500
          }
        }
        
        return teamColor; // fallback
      })
      .attr("stroke-width", (d) => Math.max(1, d.width || 1))
      .attr("fill", "none")
      .attr("opacity", 0.5)
      .attr("class", "link-path")
      .attr("data-driver", (d) => d.code)
      .attr("data-quali", (d) => d.qualifyingPosition)
      .attr("data-race", (d) => d.racePosition)
      .attr("data-change", (d) => d.positionChange)
      .on("mouseover", linkEvents.onMouseOver)
      .on("mousemove", linkEvents.onMouseMove)
      .on("mouseout", linkEvents.onMouseOut)
      .attr("stroke-dasharray", (d) => {
        // Use dashed lines for drivers who didn't finish the race (DNF)
        if (d.source.position === d.target.position) {
          return "4 2";
        }
        return "none";
      });
    
    // Draw nodes
    const nodes_g = chartArea.append("g")
      .selectAll("g")
      .data(sankeyData.nodes)
      .join("g")
      .attr("class", "sankey-node");
    
    // Add node rectangles
    nodes_g.append("rect")
      .attr("x", (d) => d.x0 || 0)
      .attr("y", (d) => d.y0 || 0)
      .attr("height", (d) => Math.max(1, (d.y1 || 0) - (d.y0 || 0)))
      .attr("width", (d) => (d.x1 || 0) - (d.x0 || 0))
      .attr("fill", (d) => {
        const team = d.team;
        let normalizedTeam = team.toLowerCase();
        if (normalizedTeam === "alphatauri") normalizedTeam = "rb";
        if (normalizedTeam === "alfa") normalizedTeam = "sauber";
        return TEAM_COLORS[normalizedTeam] || "#666666";
      })
      .attr("opacity", 0.85)
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("data-position", (d) => d.position)
      .attr("data-type", (d) => d.type)
      .attr("class", "node-rect")
      .on("mouseover", nodeEvents.onMouseOver)
      .on("mousemove", nodeEvents.onMouseMove)
      .on("mouseout", nodeEvents.onMouseOut);
    
    // Use consistent offsets for all screen sizes
    const positionOffset = 22;
    const driverOffset = 62;
    
    // Add position numbers with consistent spacing (only for qualifying and race)
    nodes_g.append("text")
      .attr("x", (d) => {
        if (d.type === "qualifying") {
          return (d.x0 || 0) - positionOffset;
        } else if (d.type === "race") {
          return (d.x1 || 0) + positionOffset;
        }
        return 0; // Grid nodes don't show position labels
      })
      .attr("y", (d) => ((d.y0 || 0) + (d.y1 || 0)) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) => d.type === "qualifying" ? "end" : "start")
      .text((d) => d.type === "grid" ? "" : d.position) // Don't show position for grid
      .attr("font-size", "10px")
      .attr("fill", "currentColor")
      .attr("class", "position-label")
      .style("opacity", (d) => d.type === "grid" ? 0 : 1); // Hide grid position labels
    
    // Add driver codes with sufficient consistent spacing (only for qualifying and race)
    nodes_g.append("text")
      .attr("x", (d) => {
        if (d.type === "qualifying") {
          return (d.x0 || 0) - driverOffset;
        } else if (d.type === "race") {
          return (d.x1 || 0) + driverOffset;
        }
        return 0; // Grid nodes don't show driver names
      })
      .attr("y", (d) => ((d.y0 || 0) + (d.y1 || 0)) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) => d.type === "qualifying" ? "end" : "start")
      .text((d) => d.type === "grid" ? "" : d.name) // Don't show names for grid
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .attr("fill", (d) => {
        // Use team colors for driver names
        const team = d.team;
        let normalizedTeam = team.toLowerCase();
        if (normalizedTeam === "alphatauri") normalizedTeam = "rb";
        if (normalizedTeam === "alfa") normalizedTeam = "sauber";
        return TEAM_COLORS[normalizedTeam] || "#666666";
      })
      .attr("class", "driver-code-label")
      .style("opacity", (d) => d.type === "grid" ? 0 : 1); // Hide grid driver labels
    
    // Draw axes labels with consistent positioning
    chartArea.append("text")
      .attr("y", -14)
      .attr("x", -10)
      .attr("text-anchor", "start")
      .text("QUALIFYING")
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .attr("fill", "currentColor")
      .attr("opacity", 0.9)
      .attr("letter-spacing", "0.5px")
      .attr("class", "axis-label");
    
    // Add grid label in the middle
    chartArea.append("text")
      .attr("y", -14)
      .attr("x", width / 2)
      .attr("text-anchor", "middle")
      .text("GRID")
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .attr("fill", "currentColor")
      .attr("opacity", 0.9)
      .attr("letter-spacing", "0.5px")
      .attr("class", "axis-label");
    
    chartArea.append("text")
      .attr("y", -14)
      .attr("x", width + 10)
      .attr("text-anchor", "end")
      .text("RACE RESULT")
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .attr("fill", "currentColor")
      .attr("opacity", 0.9)
      .attr("letter-spacing", "0.5px")
      .attr("class", "axis-label");
    
    // Add entry animation - with staggered loading
    svg.selectAll(".sankey-node rect")
      .attr("opacity", 0)
      .transition()
      .duration(300)
      .delay((_, i) => i * 20)
      .attr("opacity", 0.85);
    
    svg.selectAll(".sankey-node text")
      .attr("opacity", 0)
      .transition()
      .duration(300)
      .delay((_, i) => 300 + i * 10)
      .attr("opacity", 1);
    
    svg.selectAll(".link-path")
      .attr("stroke-dashoffset", function(this: SVGPathElement) {
        return this.getTotalLength();
      })
      .attr("stroke-dasharray", function(this: SVGPathElement) {
        return this.getTotalLength();
      })
      .transition()
      .duration(800)
      .delay((_, i) => i * 30)
      .ease(d3.easeLinear)
      .attr("stroke-dashoffset", 0);
      
  }, [data, dimensions, createTooltip, createSankeyGenerator, linkMouseHandlers, nodeMouseHandlers, isMobile]);
  
  // Force chart rendering after mount and data load
  useEffect(() => {
    // Trigger draw on initial render
    if (data?.processedData && dimensions.width > 0) {
      drawChart();
    } else if (data?.processedData && !isLoading && dimensions.width === 0 && sankeyRef.current) {
      // If we have data but no dimensions yet, force dimensions calculation
      const { width } = sankeyRef.current.getBoundingClientRect();
      if (width > 0) {
        setDimensions({
          width: width,
          height: Math.max(400, Math.min(600, width * 0.8))
        });
      }
    }
    
    // Clean up function
    return () => {
      if (sankeyRef.current) {
        d3.select(sankeyRef.current).select("svg").remove();
        d3.select(sankeyRef.current).select(".tooltip").remove();
      }
    };
  }, [data, dimensions.width, isLoading, drawChart]);
  
  // Add a secondary effect to ensure chart is drawn when container is visible
  useEffect(() => {
    if (sankeyRef.current && data?.processedData && dimensions.width === 0) {
      // Use ResizeObserver to detect when the container becomes visible
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width } = entry.contentRect;
          if (width > 0 && dimensions.width === 0) {
            setDimensions({
              width: width,
              height: Math.max(400, Math.min(600, width * 0.8))
            });
            break;
          }
        }
      });
      
      resizeObserver.observe(sankeyRef.current);
      
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [data, dimensions.width]);

  // Watch for changes to year and round props
  useEffect(() => {
    // When the year or round changes, reset dimensions and reinitialize
    setHasInitialized(false);
    setDimensions({ width: 0, height: 0 });
    
    if (sankeyRef.current) {
      const { width } = sankeyRef.current.getBoundingClientRect();
      if (width > 0) {
        setDimensions({
          width: width,
          height: Math.max(400, Math.min(600, width * 0.8))
        });
        setHasInitialized(true);
      }
    }
  }, [year, round]);

  return (
    <div className="h-full w-full">
      {isLoading || isRetrying ? (
        <div className="flex flex-col items-center justify-center h-64 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <div className="text-sm text-muted-foreground">
            {isRetrying ? "Retrying..." : "Loading race data..."}
          </div>
        </div>
      ) : !data?.processedData ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            <div>{data?.error || "Could not load qualifying and race data"}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              The chart requires both qualifying and race data from a completed race weekend.
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry} 
              className="mt-3 gap-2"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div 
            ref={sankeyRef} 
            className="w-full overflow-hidden py-2"
            style={{ minHeight: "400px" }}
          />
          
          <div className="mt-4 pt-2 border-t border-border">
            <div className="flex flex-wrap gap-4 justify-center">
              <Badge 
                variant="outline" 
                className="flex items-center justify-center gap-2 text-sm"
              >
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                Gained Positions
              </Badge>
              <Badge 
                variant="outline" 
                className="flex items-center justify-center gap-2 text-sm"
              >
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                Lost Positions
              </Badge>
              <Badge 
                variant="outline" 
                className="flex items-center justify-center gap-2 text-sm"
              >
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                Maintained Position
              </Badge>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProgressionChart; 