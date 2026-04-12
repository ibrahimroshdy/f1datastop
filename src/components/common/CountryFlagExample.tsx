import React from 'react';
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle } from "@/components/f1";
import CountryFlag from './CountryFlag';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        <F1CardTitle>Country Flags using react-country-flag</F1CardTitle>
      </F1CardHeader>
      <F1CardContent>
        <Tabs defaultValue="svg">
          <TabsList className="mb-4">
            <TabsTrigger value="svg">SVG Flags</TabsTrigger>
            <TabsTrigger value="emoji">Emoji Flags</TabsTrigger>
          </TabsList>
          
          <TabsContent value="svg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {EXAMPLE_COUNTRIES.map(country => (
                <div key={country} className="flex items-center gap-2 p-2 border rounded-md">
                  <CountryFlag country={country} size={24} svg={true} />
                  <span>{country}</span>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="emoji">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {EXAMPLE_COUNTRIES.map(country => (
                <div key={country} className="flex items-center gap-2 p-2 border rounded-md">
                  <CountryFlag country={country} size={24} svg={false} />
                  <span>{country}</span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="mt-6 p-4 border rounded-md bg-muted">
          <h3 className="text-sm font-medium mb-2">Implementation Notes:</h3>
          <p className="text-sm text-muted-foreground">
            The <code className="bg-muted-foreground/20 px-1 rounded">svg</code> prop toggles between SVG and emoji flags. 
            SVG flags offer consistent high-quality appearance, while emoji flags use native system emojis.
          </p>
        </div>
      </F1CardContent>
    </F1Card>
  );
};

export default CountryFlagExample; 