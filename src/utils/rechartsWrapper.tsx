
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
export const XAxis: React.FC<XAxisProps> = (props) => {
  // Create safe props, but don't remove xAxisId completely since it's needed for identification
  const safeProps = { ...props };
  
  // We'll explicitly set it to undefined if it wasn't provided
  if (!('xAxisId' in safeProps)) {
    safeProps.xAxisId = undefined;
  }
  
  return <RechartsXAxis {...safeProps} />;
};

export const YAxis: React.FC<YAxisProps> = (props) => {
  // Create safe props, but don't remove yAxisId completely since it's needed for identification
  const safeProps = { ...props };
  
  // We'll explicitly set it to undefined if it wasn't provided
  if (!('yAxisId' in safeProps)) {
    safeProps.yAxisId = undefined;
  }
  
  return <RechartsYAxis {...safeProps} />;
};

export const ReferenceLine: React.FC<ReferenceLineProps> = (props) => {
  // Create a new props object but don't remove axis IDs completely
  const safeProps = { ...props };
  
  // Only ensure they're undefined if not provided
  if (!('xAxisId' in safeProps)) {
    safeProps.xAxisId = undefined;
  }
  
  if (!('yAxisId' in safeProps)) {
    safeProps.yAxisId = undefined;
  }
  
  return <RechartsReferenceLine {...safeProps} />;
};

// Fix the Line component wrapper
export const Line: React.FC<LineProps> = (props) => {
  // Create a safe copy of props
  const safeProps = { ...props };
  
  // Ensure axis IDs are undefined if not provided, rather than removing them
  if (!('xAxisId' in safeProps)) {
    safeProps.xAxisId = undefined;
  }
  
  if (!('yAxisId' in safeProps)) {
    safeProps.yAxisId = undefined;
  }
  
  return <RechartsLine {...safeProps} />;
};
