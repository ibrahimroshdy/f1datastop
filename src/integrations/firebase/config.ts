import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDzh-EESKJn0HfNBRBH2F4e6N83Qb9bw0A',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'f1-datastop.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'f1-datastop',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'f1-datastop.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '493453461962',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:493453461962:web:b8c3bfd0c5d54c8be33a39',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-1Y6GKNVD2J'
};

// Check if we have a valid API key (non-placeholder)
const hasValidApiKey = () => {
  const apiKey = firebaseConfig.apiKey;
  return apiKey && apiKey !== 'AIzaSyDzh-EESKJn0HfNBRBH2F4e6N83Qb9bw0A';
};

// Initialize Firebase
export const app = hasValidApiKey() ? initializeApp(firebaseConfig) : null;

// Initialize Analytics
export const initAnalytics = () => {
  // Only initialize analytics in browser environments and if we have a valid API key
  if (typeof window !== 'undefined' && app) {
    try {
      const analytics = getAnalytics(app);
      
      // Configure analytics settings if needed
      // Note: We're not using setConsent as it requires specific implementation
      
      return analytics;
    } catch (error) {
      console.error('Failed to initialize Firebase Analytics:', error);
      return null;
    }
  }
  
  // Return null when not in browser or no valid API key
  if (process.env.NODE_ENV === 'development') {
    console.log('Firebase Analytics not initialized: ' + 
      (!app ? 'Missing valid API key' : 'Not in browser environment'));
  }
  
  return null;
};

export default app; 