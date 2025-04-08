
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
  // Make sure to pass all props to the wrapped component
  return <RechartsXAxis {...props} />;
};

export const YAxis = (props: YAxisProps) => {
  // Make sure to pass all props to the wrapped component
  return <RechartsYAxis {...props} />;
};

export const ReferenceLine = (props: ReferenceLineProps) => {
  // Make sure to pass all props to the wrapped component
  return <RechartsReferenceLine {...props} />;
};
