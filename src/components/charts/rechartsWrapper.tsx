import React, { useEffect, ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';

// Common props that most recharts components use
type RechartsWrapperProps = {
  width?: number | string;
  height?: number | string;
  children: ReactElement;
};

/**
 * Filter console warnings/errors from Recharts library
 */
const filterWarnings = (msg: any, ...args: any[]) => {
  // Filter out common Recharts warnings
  if (typeof msg === 'string' && (
    msg.includes('recharts') || 
    msg.includes('d3') || 
    msg.includes('Invalid property')
  )) {
    return;
  }
  
  // Filter out Clarity errors
  if (typeof msg === 'string' && msg.includes('[Clarity]')) {
    return;
  }
  
  // Log everything else
  console.error(msg, ...args);
};

/**
 * A wrapper for Recharts ResponsiveContainer that improves error handling
 */
const RechartsWrapper: React.FC<RechartsWrapperProps> = ({
  width = '100%',
  height = 300,
  children
}) => {
  useEffect(() => {
    // Override console.error to filter out recharts warnings
    const originalError = console.error;
    console.error = filterWarnings;
    
    return () => {
      // Restore original console.error when component unmounts
      console.error = originalError;
    };
  }, []);
  
  return (
    <div style={{ width: '100%', height: 'auto' }}>
      <ResponsiveContainer width={width} height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  );
};

export default RechartsWrapper; 