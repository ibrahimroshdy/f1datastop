
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

// Fixed wrapper components that explicitly set xAxisId and yAxisId if not provided
export const XAxis = (props: XAxisProps) => {
  // Ensure xAxisId is set to a default value if not provided
  const enhancedProps = {
    ...props,
    xAxisId: props.xAxisId || 0
  };
  return <RechartsXAxis {...enhancedProps} />;
};

export const YAxis = (props: YAxisProps) => {
  // Ensure yAxisId is set to a default value if not provided
  const enhancedProps = {
    ...props,
    yAxisId: props.yAxisId || 0
  };
  return <RechartsYAxis {...enhancedProps} />;
};

export const ReferenceLine = (props: ReferenceLineProps) => {
  return <RechartsReferenceLine {...props} />;
};
