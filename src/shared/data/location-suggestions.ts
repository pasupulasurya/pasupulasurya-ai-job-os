// src/shared/data/location-suggestions.ts
//
// Curated US city list for the locations ChipInput autocomplete. Includes
// "Remote" as the first suggestion (most-requested). Tilt toward tech hubs
// and secondary markets that hire international workers.

export const LOCATION_SUGGESTIONS: string[] = [
  "Remote",
  // Tier 1 tech hubs
  "San Francisco",
  "New York",
  "Seattle",
  "Boston",
  "Austin",
  "Los Angeles",
  // Tier 2 tech markets
  "Chicago",
  "Denver",
  "Washington, DC",
  "Atlanta",
  "Portland",
  "Pittsburgh",
  "Raleigh",
  "Durham",
  "Nashville",
  "Salt Lake City",
  "Phoenix",
  "Minneapolis",
  "Houston",
  "Dallas",
  "San Diego",
  // SF Bay Area neighborhoods
  "Sunnyvale",
  "Mountain View",
  "Palo Alto",
  "San Jose",
  "Oakland",
  "Redwood City",
  "Menlo Park",
  // NYC area
  "Brooklyn",
  "Jersey City",
  // Other notable
  "Cambridge",
  "Boulder",
  "Madison",
  "Ann Arbor",
  "Columbus",
  "Indianapolis",
  "Miami",
  "Tampa",
  "Charlotte",
  "Philadelphia",
];
