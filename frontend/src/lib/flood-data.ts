export type RiskLevel = "low" | "moderate" | "high";

export function classifyRisk(percent: number): RiskLevel {
  if (percent <= 33) return "low";
  if (percent <= 66) return "moderate";
  return "high";
}

export function riskLabel(level: RiskLevel): string {
  return level === "low" ? "Low Risk" : level === "moderate" ? "Moderate Risk" : "High Risk";
}

export interface Community {
  slug: string;
  name: string;
  district: string;
  population: string;
  // Legacy static profile band used for presentation-only context on non-live pages.
  riskPercent: number;
  elevationM: number;
  drainageQuality: "Poor" | "Fair" | "Good";
  recentIncidents: number;
  notes: string;
}

export const communities: Community[] = [
  {
    slug: "accra-central",
    name: "Accra Central",
    district: "Accra Metropolitan",
    population: "~ 65,000",
    riskPercent: 82,
    elevationM: 6,
    drainageQuality: "Poor",
    recentIncidents: 7,
    notes:
      "Low-lying commercial core with historic drainage overflow along Kinbu and Kimberley streets.",
  },
  {
    slug: "ashaiman",
    name: "Ashaiman",
    district: "Ashaiman Municipal",
    population: "~ 190,000",
    riskPercent: 74,
    elevationM: 12,
    drainageQuality: "Poor",
    recentIncidents: 5,
    notes:
      "High-density settlement with informal drainage; flash flooding common during peak rainy season.",
  },
  {
    slug: "dansoman",
    name: "Dansoman",
    district: "Ablekuma West",
    population: "~ 110,000",
    riskPercent: 48,
    elevationM: 18,
    drainageQuality: "Fair",
    recentIncidents: 3,
    notes:
      "Mixed residential zone. Flooding concentrated near the Densu estuary during high tide events.",
  },
  {
    slug: "chorkor",
    name: "Chorkor",
    district: "Ablekuma South",
    population: "~ 55,000",
    riskPercent: 88,
    elevationM: 3,
    drainageQuality: "Poor",
    recentIncidents: 9,
    notes: "Coastal fishing community with tidal surge exposure and blocked lagoon outlets.",
  },
  {
    slug: "kaneshie",
    name: "Kaneshie",
    district: "Ablekuma Central",
    population: "~ 80,000",
    riskPercent: 61,
    elevationM: 15,
    drainageQuality: "Fair",
    recentIncidents: 4,
    notes: "Market district with heavy runoff. Odaw tributary overtops during sustained downpours.",
  },
  {
    slug: "odorkor",
    name: "Odorkor",
    district: "Ablekuma North",
    population: "~ 95,000",
    riskPercent: 42,
    elevationM: 22,
    drainageQuality: "Fair",
    recentIncidents: 2,
    notes: "Rolling terrain reduces standing water; localised flooding at Sakaman junction.",
  },
  {
    slug: "madina",
    name: "Madina",
    district: "La Nkwantanang-Madina",
    population: "~ 140,000",
    riskPercent: 29,
    elevationM: 45,
    drainageQuality: "Good",
    recentIncidents: 1,
    notes: "Higher elevation and improved storm drains keep flood impact limited.",
  },
  {
    slug: "tema",
    name: "Tema",
    district: "Tema Metropolitan",
    population: "~ 160,000",
    riskPercent: 21,
    elevationM: 30,
    drainageQuality: "Good",
    recentIncidents: 1,
    notes: "Planned city with engineered drainage; risk concentrated in older Site 1 areas.",
  },
];
