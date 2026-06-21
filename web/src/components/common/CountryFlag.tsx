import React from 'react';
import ReactCountryFlag from 'react-country-flag';
import { Flag } from 'lucide-react';

// Map of country names to their ISO 3166-1 alpha-2 codes for react-country-flag
const countryToCode: { [key: string]: string } = {
  "Argentina": "AR",
  "Australia": "AU",
  "Austria": "AT",
  "Azerbaijan": "AZ",
  "Bahrain": "BH",
  "Belgium": "BE",
  "Brazil": "BR",
  "Canada": "CA",
  "China": "CN",
  "Denmark": "DK",
  "Egypt": "EG",
  "Finland": "FI",
  "France": "FR",
  "Germany": "DE",
  "Hungary": "HU",
  "Italy": "IT",
  "Japan": "JP",
  "Mexico": "MX",
  "Monaco": "MC",
  "Netherlands": "NL",
  "Poland": "PL",
  "Portugal": "PT",
  "Qatar": "QA",
  "Russia": "RU",
  "Saudi Arabia": "SA",
  "Singapore": "SG",
  "South Africa": "ZA",
  "Spain": "ES",
  "Sweden": "SE",
  "Switzerland": "CH",
  "Thailand": "TH",
  "Turkey": "TR",
  "UK": "GB",
  "U.K.": "GB",
  "New Zealand": "NZ",
  "New Zealander": "NZ",
  "UAE": "AE",
  "U.A.E.": "AE",
  "United Arab Emirates": "AE",
  "United Kingdom": "GB",
  "United States": "US",
  "USA": "US",
  "Venezuela": "VE",
  "Vietnam": "VN",
  "Miami": "US",
  "Vegas": "US",
  "Las Vegas": "US",
  "Abu Dhabi": "AE",
  "Emilia Romagna": "IT",
  "Imola": "IT",
  "Emilia": "IT",
  "Styria": "AT",
  "Sao Paulo": "BR",
  "Sakhir": "BH",
  "Jeddah": "SA",
  "Spielberg": "AT",
  "Budapest": "HU",
  "Zandvoort": "NL",
  "Monza": "IT",
  "Sochi": "RU",
  "Austin": "US",
  "Mexico City": "MX",
  "Yas Marina": "AE",
  "Miami Gardens": "US",
  "Monte Carlo": "MC",
  "Silverstone": "GB",
  "Spa": "BE",
  "Spa-Francorchamps": "BE",
  "Barcelona": "ES",
  "Catalunya": "ES",
  "Montreal": "CA",
  "Baku": "AZ",
  "Suzuka": "JP",
  "Losail": "QA",
  "Shanghai": "CN",
};

interface CountryFlagProps {
  country: string;
  size?: number;
  className?: string;
  showName?: boolean;
}

/**
 * Get the ISO country code for a country name
 */
export const getCountryCode = (country: string): string | null => {
  if (!country) return null;
  
  // Normalize the country name to handle case sensitivity
  const normalizedCountry = country.trim();
  
  // Direct lookup
  if (countryToCode[normalizedCountry]) {
    return countryToCode[normalizedCountry];
  }
  
  // Try case-insensitive lookup
  const lowerCountry = normalizedCountry.toLowerCase();
  for (const [key, code] of Object.entries(countryToCode)) {
    if (key.toLowerCase() === lowerCountry) {
      return code;
    }
  }
  
  // Try to find a partial match for compound names
  for (const [key, code] of Object.entries(countryToCode)) {
    if (normalizedCountry.includes(key) || key.includes(normalizedCountry)) {
      return code;
    }
  }
  
  console.warn(`No country code found for: ${country}`);
  return null;
};

/**
 * React component to display a country flag using react-country-flag
 */
const CountryFlag: React.FC<CountryFlagProps> = ({ 
  country, 
  size = 20, 
  className = "", 
  showName = false,
}) => {
  const countryCode = getCountryCode(country);
  
  if (!countryCode) {
    return (
      <Flag
        className={`inline-block text-muted-foreground ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
        aria-hidden
      />
    );
  }
  
  return (
    <span className={`inline-flex items-center ${className}`}>
      <ReactCountryFlag
        countryCode={countryCode}
        svg
        style={{
          width: `${size}px`,
          height: 'auto',
        }}
        title={country}
      />
      {showName && <span className="ml-2">{country}</span>}
    </span>
  );
};

export default CountryFlag; 