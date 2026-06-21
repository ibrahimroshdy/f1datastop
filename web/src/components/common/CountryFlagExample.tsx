import { F1Card, F1CardContent, F1CardHeader, F1CardTitle } from "@/components/f1";
import CountryFlag from './CountryFlag';

const EXAMPLE_COUNTRIES = [
  "United States",
  "United Kingdom",
  "Italy",
  "Germany",
  "Spain",
  "Japan",
  "Brazil",
  "Canada",
  "Australia",
  "Monaco",
  "Singapore",
  "Netherlands",
  "Belgium",
  "Hungary",
  "Saudi Arabia",
  "Qatar",
  "Bahrain",
  "Abu Dhabi",
  "Azerbaijan",
  "China"
];

const CountryFlagExample = () => {
  return (
    <F1Card>
      <F1CardHeader>
        <F1CardTitle>Country Flags (SVG)</F1CardTitle>
      </F1CardHeader>
      <F1CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {EXAMPLE_COUNTRIES.map(country => (
            <div key={country} className="flex items-center gap-2 p-2 border rounded-md">
              <CountryFlag country={country} size={24} />
              <span>{country}</span>
            </div>
          ))}
        </div>
      </F1CardContent>
    </F1Card>
  );
};

export default CountryFlagExample;
