
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

// Simple wrapper components that don't try to set any additional props
export const XAxis = (props: XAxisProps) => {
  return <RechartsXAxis {...props} />;
};

export const YAxis = (props: YAxisProps) => {
  return <RechartsYAxis {...props} />;
};

export const ReferenceLine = (props: ReferenceLineProps) => {
  return <RechartsReferenceLine {...props} />;
};
