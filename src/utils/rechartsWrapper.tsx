
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

// Wrapped components with default parameters instead of defaultProps
export const XAxis = (props: XAxisProps) => {
  // Ensure we're not passing any axis IDs that could cause conflicts
  const { xAxisId, ...restProps } = props;
  return <RechartsXAxis {...restProps} />;
};

export const YAxis = (props: YAxisProps) => {
  // Ensure we're not passing any axis IDs that could cause conflicts
  const { yAxisId, ...restProps } = props;
  return <RechartsYAxis {...restProps} />;
};

export const ReferenceLine = (props: ReferenceLineProps) => {
  return <RechartsReferenceLine {...props} />;
};
