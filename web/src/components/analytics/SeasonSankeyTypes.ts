// Shared types for the Season Sankey chart.
// Kept in a separate module so SeasonSankeyChart, SeasonSankeySurface and
// SeasonSankeyTooltip can all import them without a circular dependency
// (SeasonSankeyChart renders Surface and the tooltips).

import type { SankeyNode, SankeyLink } from 'd3-sankey';
export type { SankeyGraph } from 'd3-sankey';

export type Mode = 'all' | 'driver' | 'team';

export interface SeasonSankeyChartProps {
  year: number;
}

// Node datum that feeds d3-sankey. d3-sankey mutates these in place, adding
// the computed layout fields (x0/x1/y0/y1/index/value/depth/...).
export interface SankeyNodeData {
  id: string;
  name: string;
  position: number;
  type: 'grid' | 'finish' | 'pit-lane' | 'dnf';
  team?: string;
  teamName?: string;
  fullName?: string;
  color: string;
}

// Link datum that feeds d3-sankey. `source`/`target` start as node-id strings
// and are resolved to node objects by the sankey() layout.
export interface SankeyLinkData {
  source: string;
  target: string;
  value: number;
  sourcePosition: number;
  color: string;
  dimLine: boolean;
  driverName?: string;
  driverCode?: string;
  team?: string;
  gridPosition?: number;
  racePosition?: number;
  positionChange?: number;
  isDNF?: boolean;
  isPitLane?: boolean;
  teams?: string[];
}

export type LaidOutNode = SankeyNode<SankeyNodeData, SankeyLinkData>;
export type LaidOutLink = SankeyLink<SankeyNodeData, SankeyLinkData>;

export type HoverTarget =
  | { kind: 'node'; node: LaidOutNode; x: number; y: number }
  | { kind: 'link'; link: LaidOutLink; x: number; y: number }
  | null;

// Warehouse input shapes (typed so no `any` is needed in the chart layer).
// These mirror the payload returned by `getScheduleFromDb` /
// `getRaceResultsFromDb` in web/src/services/f1Warehouse.ts.
export interface SeasonDriverResult {
  grid: string | number | null | undefined;
  position: string | number | null | undefined;
  status: string;
  Driver?: {
    code?: string | null;
    givenName?: string | null;
    familyName?: string | null;
  } | null;
  Constructor?: {
    constructorId?: string | null;
    name?: string | null;
  } | null;
  points?: string | number | null;
}

export interface SeasonRoundResult {
  round?: string | number | null;
  raceName?: string | null;
  Results?: SeasonDriverResult[] | null;
}

export interface SeasonScheduleRace {
  round: string | number | null;
}
