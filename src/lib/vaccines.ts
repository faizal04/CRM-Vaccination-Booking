// Vaccine list matching the main booking site
export const VACCINES = [
  'BCG',
  'OPV',
  'HBV',
  'DTaP+Hib+IPV+HBV (HEXA)',
  'Pneumococcal (PCV)',
  'Rotavirus',
  'Typhoid (TCV)',
  'Influenza (Flu)',
  'MMR',
  'Meningococcal (MCV)',
  'Hepatitis A',
  'Varicella',
  'HPV',
  'Other / I\'m not sure',
] as const

// Price per vaccine in INR — edit these values as needed
export const VACCINE_PRICES: Record<string, number> = {
  'BCG': 500,
  'OPV': 300,
  'HBV': 800,
  'DTaP+Hib+IPV+HBV (HEXA)': 3500,
  'Pneumococcal (PCV)': 4500,
  'Rotavirus': 2500,
  'Typhoid (TCV)': 1200,
  'Influenza (Flu)': 1500,
  'MMR': 1000,
  'Meningococcal (MCV)': 3000,
  'Hepatitis A': 1500,
  'Varicella': 2000,
  'HPV': 3500,
  "Other / I'm not sure": 1000,
}

export function getVaccinePrice(vaccine: string): number {
  return VACCINE_PRICES[vaccine] ?? 1000
}

// Chart color palette for vaccine breakdown
export const VACCINE_COLORS = [
  '#005440', '#0f6e56', '#1a8a6e', '#26a686', '#32c29e',
  '#3ddeb6', '#855300', '#a06800', '#bb7d00', '#d69200',
  '#f1a700', '#fea619', '#ffb95f', '#ffddb8',
]
