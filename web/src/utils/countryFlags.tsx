import React from 'react';

// Map of country names to their ISO 3166-1 alpha-2 codes
const countryToCode: { [key: string]: string } = {
  "Australia": "au",
  "Austria": "at",
  "Azerbaijan": "az",
  "Bahrain": "bh",
  "Belgium": "be",
  "Brazil": "br",
  "Canada": "ca",
  "China": "cn",
  "Hungary": "hu",
  "Italy": "it",
  "Japan": "jp",
  "Mexico": "mx",
  "Miami": "us",
  "Monaco": "mc",
  "Netherlands": "nl",
  "Qatar": "qa",
  "Saudi Arabia": "sa",
  "Singapore": "sg",
  "Spain": "es",
  "United Arab Emirates": "ae",
  "United Kingdom": "gb",
  "United States": "us",
  "Las Vegas": "us",
  "USA": "us"
};

interface CountryFlagProps {
  country: string;
  className?: string;
}

/**
 * Get the flag image URL for a country using the Flagcdn service
 * @param country The country name
 * @returns The URL to the country's flag image
 */
export const getCountryFlagUrl = (country: string): string => {
  const code = countryToCode[country];
  if (!code) {
    console.warn(`No country code found for: ${country}`);
    return '';
  }
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
};

/**
 * Get the flag image element for a country
 * @param country The country name
 * @returns JSX element for the flag image
 */
export const CountryFlag = ({ country, className = "" }: CountryFlagProps): React.ReactElement | null => {
  const code = countryToCode[country];
  if (!code) {
    return null;
  }
  
  return (
    <img
      src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
      alt={`${country} flag`}
      className={`inline-block h-5 w-auto ${className}`}
      loading="lazy"
    />
  );
}; 