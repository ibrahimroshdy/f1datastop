import React, { useState, useEffect } from 'react';
import { checkClarityStatus } from '../../integrations/clarity/clarityHelpers';

interface ClarityStatusProps {
  projectId: string;
}

/**
 * Component to verify if Microsoft Clarity is working correctly
 * Only use this component during development!
 */
const ClarityStatus: React.FC<ClarityStatusProps> = ({ projectId }) => {
  const [status, setStatus] = useState({
    isAvailable: false,
    isLoaded: false,
    hasQueue: false,
    queueLength: 0,
    isFullyFunctional: false,
    isNpmPackageAvailable: false,
    lastChecked: new Date()
  });
  
  const checkStatus = () => {
    const clarityStatus = checkClarityStatus();
    setStatus({
      ...clarityStatus,
      lastChecked: new Date()
    });
  };
  
  const sendTestEvent = () => {
    if (typeof window !== 'undefined' && window.clarity) {
      try {
        window.clarity('event', 'test_event_' + Date.now());
        window.clarity('set', 'test_tag', 'test_value_' + Date.now());
        alert('Test event sent to Clarity! Check your dashboard in 20-30 minutes.');
      } catch (error) {
        alert('Failed to send test event: ' + error);
      }
    } else {
      alert('Clarity is not available');
    }
  };
  
  useEffect(() => {
    // Initial check
    checkStatus();
    
    // Set up interval to check status every 5 seconds
    const intervalId = setInterval(checkStatus, 5000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Only render in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      left: '10px',
      backgroundColor: '#f0f0f0',
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '5px',
      zIndex: 9999,
      fontSize: '12px',
      maxWidth: '300px'
    }}>
      <h4 style={{ margin: '0 0 8px 0' }}>Microsoft Clarity Status</h4>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Project ID:</strong> {projectId.substring(0, 4)}...{projectId.substring(projectId.length - 4)}
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '10px' }}>
        <div>
          <strong>Available:</strong>
          <span style={{ color: status.isAvailable ? 'green' : 'red' }}>
            {status.isAvailable ? ' ✓' : ' ✗'}
          </span>
        </div>
        
        <div>
          <strong>Loaded:</strong>
          <span style={{ color: status.isLoaded ? 'green' : 'red' }}>
            {status.isLoaded ? ' ✓' : ' ✗'}
          </span>
        </div>
        
        <div>
          <strong>Has Queue:</strong>
          <span style={{ color: status.hasQueue ? 'green' : 'red' }}>
            {status.hasQueue ? ' ✓' : ' ✗'}
          </span>
        </div>
        
        <div>
          <strong>Queue Items:</strong> {status.queueLength}
        </div>
        
        <div>
          <strong>Functional:</strong>
          <span style={{ color: status.isFullyFunctional ? 'green' : 'red' }}>
            {status.isFullyFunctional ? ' ✓' : ' ✗'}
          </span>
        </div>
        
        <div>
          <strong>NPM Package:</strong>
          <span style={{ color: status.isNpmPackageAvailable ? 'green' : 'red' }}>
            {status.isNpmPackageAvailable ? ' ✓' : ' ✗'}
          </span>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
        <button 
          onClick={checkStatus}
          style={{
            padding: '5px 10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            flex: 1
          }}
        >
          Check Now
        </button>
        
        <button 
          onClick={sendTestEvent}
          style={{
            padding: '5px 10px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            flex: 1
          }}
        >
          Send Test Event
        </button>
      </div>
      
      <div style={{ fontSize: '10px', color: '#666', textAlign: 'center' }}>
        Last checked: {status.lastChecked.toLocaleTimeString()}
      </div>
    </div>
  );
};

export default ClarityStatus; 