
import React from 'react';
import {
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  ReferenceLine as RechartsReferenceLine,
  Line as RechartsLine,
  XAxisProps,
  YAxisProps,
  ReferenceLineProps,
  LineProps
} from 'recharts';

// Suppress specific React warnings about defaultProps
const originalConsoleError = console.error;
console.error = function filterWarnings(msg: any, ...args: any[]) {
  if (typeof msg === 'string' && msg.includes('Support for defaultProps will be removed from function components')) {
    return;
  }
  originalConsoleError(msg, ...args);
};

// Wrapped components with consistent props and without xAxisId/yAxisId
export const XAxis = (props: XAxisProps) => {
  // Make sure to not pass any explicit axis IDs that might conflict
  const safeProps = { ...props };
  delete safeProps.xAxisId; // Remove xAxisId to prevent conflicts
  return <RechartsXAxis {...safeProps} />;
};

export const YAxis = (props: YAxisProps) => {
  // Make sure to not pass any explicit axis IDs that might conflict
  const safeProps = { ...props };
  delete safeProps.yAxisId; // Remove yAxisId to prevent conflicts
  return <RechartsYAxis {...safeProps} />;
};

export const ReferenceLine = (props: ReferenceLineProps) => {
  // Make sure to not pass any conflicting axis IDs
  const safeProps = { ...props };
  delete safeProps.xAxisId;
  delete safeProps.yAxisId;
  return <RechartsReferenceLine {...safeProps} />;
};

// Fix the Line component wrapper to properly handle props and types
export const Line = (props: LineProps) => {
  // Remove any axis IDs to prevent conflicts
  const safeProps = { ...props } as LineProps;
  
  // Explicitly delete these properties to avoid type conflicts
  if ('xAxisId' in safeProps) delete safeProps.xAxisId;
  if ('yAxisId' in safeProps) delete safeProps.yAxisId;
  
  // Return the Recharts Line with safe props
  return <RechartsLine {...safeProps} />;
};
