
// This file now re-exports recharts components directly to maintain compatibility
// with existing files while avoiding axis ID conflicts.
// For new chart components, import directly from recharts instead.

import { XAxis as RechartsXAxis, YAxis as RechartsYAxis, ReferenceLine as RechartsReferenceLine } from 'recharts';

export const XAxis = RechartsXAxis;
export const YAxis = RechartsYAxis;
export const ReferenceLine = RechartsReferenceLine;
