import { useEffect, useState, useRef, useMemo, useCallback, useLayoutEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, RefreshCw, AlertTriangle, TrendingUpDownIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { select } from "d3-selection";
import { easeLinear } from "d3-ease";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import { useQualifyingToRaceData } from "@/hooks/useF1Data";
import { TEAM_COLORS } from "@/constants/f1Colors";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";

const d3 = {
  select,
  easeLinear
};

const QualifyingToRaceChart = () => {
  const { data, isLoading, error, refetch } = useQualifyingToRaceData();
  const sankeyRef = useRef(null);
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({
    width: 0,
    height: 0
  });
  const [raceName, setRaceName] = useState("");
  const [circuitName, setCircuitName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [countryName, setCountryName] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [lastRace, setLastRace] = useState(null);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await refetch();
    setIsRetrying(false);
  }, [refetch]);

  useEffect(() => {
    if (data?.raceData) {
      const race = data.raceData;
      setCircuitName(getRaceNameWithoutEmoji(race.raceName) || "");
      const country = race.Circuit?.Location?.country || "";
      setCountryName(country);
      setCountryCode(getCountryCode(country) || "");
      setLastRace(race);
    }
  }, [data]);

  useLayoutEffect(() => {
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
  }, []);

  useEffect(() => {
    let timeoutId;
    const updateDimensions = () => {
      if (sankeyRef.current) {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          const { width } = sankeyRef.current.getBoundingClientRect();
          if (width > 0) {
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

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    if (!hasInitialized && sankeyRef.current) {
      const checkDimensions = () => {
        const { width } = sankeyRef.current.getBoundingClientRect();
        if (width > 0 && dimensions.width === 0) {
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

      requestAnimationFrame(checkDimensions);
    }

    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(timeoutId);
    };
  }, [dimensions.width, hasInitialized]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const createTooltip = useCallback(() => {
    if (!sankeyRef.current) return null;
    d3.select(sankeyRef.current).select(".tooltip").remove();
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

  const createSankeyGenerator = useMemo(() => {
    return (width, height) => {
      return sankey()
        .nodeId((d) => d.id)
        .nodeWidth(15)
        .nodePadding(8)
        .extent([
          [0, 0],
          [width, height]
        ])
        .nodeSort((a, b) => {
          if (a.type === "qualifying" && b.type === "qualifying") {
            return a.position - b.position;
          }
          if (a.type === "race" && b.type === "race") {
            return a.position - b.position;
          }
          return a.type === "qualifying" ? -1 : 1;
        });
    };
  }, []);

  const linkMouseHandlers = useCallback((tooltip) => {
    return {
      onMouseOver: function(event, d) {
        d3.select(this)
          .attr("opacity", 0.9)
          .attr("stroke-width", () => Math.max(3, (d.width || 1) * 1.5))
          .style("filter", "drop-shadow(0px 1px 2px rgba(0,0,0,0.2))");

        const positionChange = d.qualifyingPosition - d.racePosition;
        const positionChangeText = positionChange > 0 ? 
          `+${positionChange} positions` : 
          positionChange < 0 ? 
          `${positionChange} positions` : 
          `Maintained position`;

        const statusHTML = d.isDNF ? 
          `<div class="mt-1 pt-1 border-t border-muted text-xs text-red-500 font-medium">${d.status}</div>` : 
          '';

        tooltip
          .style("visibility", "visible")
          .style("opacity", 1)
          .html(`
            <div>
              <div class="font-bold text-sm mb-1">${d.name}</div>
              <div class="text-xs text-muted-foreground mb-2">${d.teamName}</div>
              <div class="grid grid-cols-2 gap-x-2 text-xs">
                <div>Qualifying:</div>
                <div class="font-mono font-medium">P${d.qualifyingPosition}</div>
                <div>Race:</div>
                <div class="font-mono font-medium">P${d.racePosition}</div>
                <div>Change:</div>
                <div class="font-mono font-medium ${positionChange > 0 ? "text-emerald-500" : positionChange < 0 ? "text-red-500" : "text-blue-500"}">${positionChangeText}</div>
              </div>
              ${statusHTML}
            </div>
          `)
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 28 + "px");
      },
      onMouseMove: function(event) {
        tooltip
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 28 + "px");
      },
      onMouseOut: function() {
        d3.select(this)
          .attr("opacity", 0.5)
          .attr("stroke-width", (d) => Math.max(1, d.width || 1))
          .style("filter", "none");
        tooltip
          .style("visibility", "hidden")
          .style("opacity", 0);
      }
    };
  }, []);

  const nodeMouseHandlers = useCallback((tooltip) => {
    return {
      onMouseOver: function(event, d) {
        d3.select(this)
          .attr("opacity", 1)
          .attr("stroke", "currentColor")
          .attr("stroke-width", 1.5);

        const parentNode = this.parentElement;
        if (parentNode) {
          d3.select(parentNode)
            .insert("rect", ":first-child")
            .attr("class", "hover-glow")
            .attr("x", (d.x0 || 0) - 2)
            .attr("y", (d.y0 || 0) - 2)
            .attr("height", Math.max(1, (d.y1 || 0) - (d.y0 || 0)) + 4)
            .attr("width", (d.x1 || 0) - (d.x0 || 0) + 4)
            .attr("fill", "currentColor")
            .attr("opacity", 0.05)
            .attr("rx", 5)
            .attr("ry", 5);
        }

        const statusHTML = d.type === 'race' && d.isDNF ? 
          `<div class="mt-1 pt-1 border-t border-muted text-xs text-red-500 font-medium">${d.status}</div>` : 
          '';

        tooltip
          .style("visibility", "visible")
          .style("opacity", 1)
          .html(`
            <div>
              <div class="font-bold text-sm mb-1">${d.fullName}</div>
              <div class="text-xs text-muted-foreground mb-2">${d.teamName}</div>
              <div class="grid grid-cols-2 gap-x-2 text-xs">
                <div>${d.type === 'qualifying' ? 'Qualifying' : 'Race'} Position:</div>
                <div class="font-mono font-medium">P${d.position}</div>
              </div>
              ${statusHTML}
            </div>
          `)
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 28 + "px");
      },
      onMouseMove: function(event) {
        tooltip
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 28 + "px");
      },
      onMouseOut: function() {
        d3.select(this)
          .attr("opacity", 0.85)
          .attr("stroke", "none");
        
        const parentNode = this.parentElement;
        if (parentNode) {
          d3.select(parentNode)
            .selectAll(".hover-glow")
            .remove();
        }
        
        tooltip
          .style("visibility", "hidden")
          .style("opacity", 0);
      }
    };
  }, []);

  const drawChart = useCallback(() => {
    console.log('Drawing chart with dimensions:', dimensions);
    if (!data?.processedData || dimensions.width <= 0 || !sankeyRef.current) {
      console.log('Cannot draw chart, missing required data or dimensions:', {
        hasData: !!data?.processedData,
        width: dimensions.width,
        hasRef: !!sankeyRef.current
      });
      return;
    }

    if (svgRef.current) {
      d3.select(svgRef.current).remove();
    }

    const { nodes, links } = data.processedData;

    const tooltip = createTooltip();
    if (!tooltip) return;

    const svg = d3.select(sankeyRef.current)
      .append("svg")
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .append("g");

    svgRef.current = d3.select(sankeyRef.current).select("svg").node();

    const margin = {
      top: 24,
      right: 100,
      bottom: 20,
      left: 100
    };

    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom - 20;

    const chartArea = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const qualifyingNodes = nodes.filter((n) => n.type === "qualifying").sort((a, b) => a.position - b.position);
    const raceNodes = nodes.filter((n) => n.type === "race").sort((a, b) => a.position - b.position);

    const sortedNodes = [
      ...qualifyingNodes,
      ...raceNodes
    ];

    const sankeyGenerator = createSankeyGenerator(width, height);

    const sankeyData = sankeyGenerator({
      nodes: sortedNodes,
      links: links
    });

    const linkEvents = linkMouseHandlers(tooltip);
    const nodeEvents = nodeMouseHandlers(tooltip);

    chartArea.append("g")
      .selectAll("path")
      .data(sankeyData.links)
      .join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", (d) => {
        const teamName = d.source.team;
        let normalizedTeam = teamName.toLowerCase();
        if (normalizedTeam === "alphatauri") normalizedTeam = "rb";
        if (normalizedTeam === "alfa") normalizedTeam = "sauber";
        const teamColor = TEAM_COLORS[normalizedTeam] || "#666666";

        if (d.qualifyingPosition < d.racePosition) {
          return "#ef4444";
        } else if (d.qualifyingPosition > d.racePosition) {
          return "#10b981";
        } else {
          return "#3b82f6";
        }
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
        if (d.source.position === d.target.position) {
          return "4 2";
        }
        return "none";
      });

    const nodes_g = chartArea.append("g")
      .selectAll("g")
      .data(sankeyData.nodes)
      .join("g")
      .attr("class", "sankey-node");

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

    const positionOffset = 22;
    const driverOffset = 62;

    nodes_g.append("text")
      .attr("x", (d) => d.type === "qualifying" ? (d.x0 || 0) - positionOffset : (d.x1 || 0) + positionOffset)
      .attr("y", (d) => ((d.y0 || 0) + (d.y1 || 0)) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) => d.type === "qualifying" ? "end" : "start")
      .text((d) => d.position)
      .attr("font-size", "10px")
      .attr("fill", "currentColor")
      .attr("class", "position-label");

    nodes_g.append("text")
      .attr("x", (d) => {
        return d.type === "qualifying" ? (d.x0 || 0) - driverOffset : (d.x1 || 0) + driverOffset;
      })
      .attr("y", (d) => ((d.y0 || 0) + (d.y1 || 0)) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) => d.type === "qualifying" ? "end" : "start")
      .text((d) => d.name)
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .attr("fill", (d) => {
        const team = d.team;
        let normalizedTeam = team.toLowerCase();
        if (normalizedTeam === "alphatauri") normalizedTeam = "rb";
        if (normalizedTeam === "alfa") normalizedTeam = "sauber";
        return TEAM_COLORS[normalizedTeam] || "#666666";
      })
      .attr("class", "driver-code-label");

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
      .attr("stroke-dashoffset", function() {
        return this.getTotalLength();
      })
      .attr("stroke-dasharray", function() {
        return this.getTotalLength();
      })
      .transition()
      .duration(800)
      .delay((_, i) => i * 30)
      .ease(d3.easeLinear)
      .attr("stroke-dashoffset", 0);

    console.log('Chart drawn successfully');
  }, [
    data,
    dimensions,
    createTooltip,
    createSankeyGenerator,
    linkMouseHandlers,
    nodeMouseHandlers,
    isMobile
  ]);

  useEffect(() => {
    if (data?.processedData && dimensions.width > 0) {
      console.log('Triggering chart draw based on data and dimensions');
      drawChart();
    } else if (data?.processedData && !isLoading && dimensions.width === 0 && sankeyRef.current) {
      console.log('Have data but no dimensions, forcing recalculation');
      const { width } = sankeyRef.current.getBoundingClientRect();
      if (width > 0) {
        setDimensions({
          width: width,
          height: Math.max(400, Math.min(600, width * 0.8))
        });
      }
    }

    return () => {
      if (sankeyRef.current) {
        d3.select(sankeyRef.current).select("svg").remove();
        d3.select(sankeyRef.current).select(".tooltip").remove();
      }
    };
  }, [data, dimensions.width, isLoading, drawChart]);

  useEffect(() => {
    if (sankeyRef.current && data?.processedData && dimensions.width === 0) {
      const resizeObserver = new ResizeObserver((entries) => {
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

  const openRaceDetails = () => {
    if (lastRace) {
      setIsDialogOpen(true);
    }
  };

  const closeRaceDetails = () => {
    setIsDialogOpen(false);
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <TrendingUpDownIcon className="h-5 w-5 text-primary mr-1" />
            Qualifying to Race Progression
          </CardTitle>
        </div>
        <CardDescription>
          How drivers progressed from qualifying to race positions
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  Gained Positions
                </Badge>
                <Badge
                  variant="outline"
                  className="flex items-center justify-center gap-2 text-sm"
                >
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  Lost Positions
                </Badge>
                <Badge
                  variant="outline"
                  className="flex items-center justify-center gap-2 text-sm"
                >
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  Maintained Position
                </Badge>
              </div>
              {!isLoading && !error && circuitName && (
                <div className="mt-4 text-center">
                  <Badge
                    variant="secondary"
                    className="flex items-center justify-center gap-2 mx-auto py-1 px-3 cursor-pointer hover:outline hover:outline-2 hover:outline-red-500 transition-all"
                    onClick={openRaceDetails}
                  >
                    <span className="inline-flex items-center">
                      <ReactCountryFlag
                        countryCode={countryCode || ""}
                        svg
                        style={{
                          width: "16px",
                          height: "auto",
                          display: "inline-block",
                          verticalAlign: "middle"
                        }}
                        title={countryName}
                      />
                    </span>
                    <span>{circuitName}</span>
                  </Badge>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
      {lastRace && (
        <RaceDetailDialog
          isOpen={isDialogOpen}
          onClose={closeRaceDetails}
          race={lastRace}
        />
      )}
    </Card>
  );
};

export default QualifyingToRaceChart;
