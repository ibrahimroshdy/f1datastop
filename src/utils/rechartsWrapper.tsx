
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

// The root of the issue is with this Line wrapper. Let's fix it by addressing the type issues.
export const Line: React.FC<Omit<LineProps, 'xAxisId' | 'yAxisId'>> = (props) => {
  // Create a new props object without xAxisId and yAxisId
  // This syntax ensures we're correctly handling the types
  const { xAxisId: _, yAxisId: __, ...safeProps } = props as any;
  
  // Pass the cleaned props to RechartsLine
  return <RechartsLine {...safeProps} />;
};
