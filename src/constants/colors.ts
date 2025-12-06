export const COLOR_PALETTE = {
  background: {
    sky: '#4a90e2', // Deep Azure
    fog: '#87CEEB', // Lighter horizon
    mountainShadow: '#3e4452', // Dark blue-grey for rock
  },
  primaryEnvironment: {
    snowWhite: '#F3F7FA',
    iceBlue: '#BFE3F5',
    shadowGray: '#9BA4AE',
  },
  terrainAndObjects: {
    rockGray: '#6D7178',
    darkBarkBrown: '#5A3A25',
    lightWoodBrown: '#A06E46',
  },
  trees: {
    pineGreen: '#3F7C3C',
    darkForestGreen: '#2E5A2B',
  },
  charactersAndGear: {
    redJacket: '#D94B3D',
    orangeRedAccent: '#E24C2A',
  },
  debugTestColors: {
    brightPink: '#FF00FF',
    brightGreen: '#00FF00',
    brightBlue: '#0000FF',
  },
} as const;

export type ColorPalette = typeof COLOR_PALETTE;

export type ColorCategory = keyof ColorPalette;

export type ColorName<TCategory extends ColorCategory = ColorCategory> =
  keyof ColorPalette[TCategory];

export type ColorHex<TCategory extends ColorCategory = ColorCategory> =
  ColorPalette[TCategory][ColorName<TCategory>];

export const getColorHex = <TCategory extends ColorCategory, TName extends ColorName<TCategory>>(
  category: TCategory,
  name: TName
): ColorHex<TCategory> => COLOR_PALETTE[category][name];
