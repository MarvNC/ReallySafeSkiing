export const COLOR_PALETTE = {
  background: {
    sky: '#cfe6ff',
    fog: '#d7ecff',
    mountainShadow: '#3e4452',
  },
  primaryEnvironment: {
    snowWhite: '#ffffff', // Pure white for mid-ground
    farMountain: '#e8f4f8', // Bluish tint for back mountains (from reference)
    iceBlue: '#BFE3F5',
    shadowGray: '#9BA4AE',
  },
  terrainAndObjects: {
    rockGray: '#5a5e66', // Slightly bluer gray
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
