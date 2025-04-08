
import React from 'react';
import {
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  ReferenceLine as RechartsReferenceLine,
  XAxisProps,
  YAxisProps,
  ReferenceLineProps
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
  const { xAxisId, ...safeProps } = props;
  return <RechartsXAxis {...safeProps} />;
};

export const YAxis = (props: YAxisProps) => {
  // Make sure to not pass any explicit axis IDs that might conflict
  const { yAxisId, ...safeProps } = props;
  return <RechartsYAxis {...safeProps} />;
};

export const ReferenceLine = (props: ReferenceLineProps) => {
  // Make sure to not pass any conflicting axis IDs
  const { xAxisId, yAxisId, ...safeProps } = props;
  return <RechartsReferenceLine {...safeProps} />;
};
