/**
 * The 16 real World Cup 2026 host stadiums. Ported from the Rails seed
 * `STADIUMS`. Order matters: the fixture schedule references these by index.
 */
export interface StadiumSeed {
  name: string;
  city: string;
  country: string;
}

export const STADIUMS: StadiumSeed[] = [
  { name: 'Estadio Azteca', city: 'Mexico City', country: 'Mexico' },
  { name: 'Estadio Akron', city: 'Guadalajara', country: 'Mexico' },
  { name: 'Estadio BBVA', city: 'Monterrey', country: 'Mexico' },
  { name: 'BMO Field', city: 'Toronto', country: 'Canada' },
  { name: 'BC Place', city: 'Vancouver', country: 'Canada' },
  { name: 'MetLife Stadium', city: 'East Rutherford', country: 'USA' },
  { name: 'SoFi Stadium', city: 'Inglewood', country: 'USA' },
  { name: 'AT&T Stadium', city: 'Arlington', country: 'USA' },
  { name: 'NRG Stadium', city: 'Houston', country: 'USA' },
  { name: 'Mercedes-Benz Stadium', city: 'Atlanta', country: 'USA' },
  { name: 'Hard Rock Stadium', city: 'Miami Gardens', country: 'USA' },
  { name: 'Lincoln Financial Field', city: 'Philadelphia', country: 'USA' },
  { name: 'Lumen Field', city: 'Seattle', country: 'USA' },
  { name: "Levi's Stadium", city: 'Santa Clara', country: 'USA' },
  { name: 'Gillette Stadium', city: 'Foxborough', country: 'USA' },
  { name: 'Arrowhead Stadium', city: 'Kansas City', country: 'USA' },
];
