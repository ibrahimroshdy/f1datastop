/**
 * API Configuration Constants
 * This file contains all API endpoints, function URLs, and other API-related configuration.
 */

// Supabase Function URLs
export const SUPABASE_FUNCTIONS = {
  NOTIFY_SLACK: "https://envqfquhkcbnitwlzepx.functions.supabase.co/notify-slack",
  VERIFY_CAPTCHA: "https://envqfquhkcbnitwlzepx.functions.supabase.co/verify-captcha",
};

// F1 API Base URLs
export const F1_API = {
  ERGAST: "https://api.jolpi.ca/ergast/f1",
  OPENF1: "https://api.openf1.org/v1",
};

// Third-party API Configuration
export const THIRD_PARTY_APIS = {
  WEATHER: "https://api.open-meteo.com/v1",
};

// Google reCAPTCHA configuration
export const RECAPTCHA = {
  SITE_KEY: "6LcYyxIrAAAAAEwZXGJ14TO5fztt52s1lgP6qie1", // User's actual site key
};

// API Request Configuration
export const API_CONFIG = {
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  CACHE_DURATION: 1000 * 60 * 60, // 1 hour in milliseconds
}; 