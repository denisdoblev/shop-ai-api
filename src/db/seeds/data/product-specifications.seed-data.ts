const headphoneSpecifications = {
  'sony-wh-1000xm6': [30, 254, true, 'Bluetooth 5.3', true],
  'bose-quietcomfort-ultra-headphones': [24, 250, true, 'Bluetooth 5.3', true],
  'apple-airpods-max': [20, 386, true, 'Bluetooth 5.0', true],
  'sennheiser-momentum-4-wireless': [60, 293, true, 'Bluetooth 5.2', true],
  'beats-studio-pro': [40, 260, true, 'Bluetooth 5.3', true],
  'jbl-tour-one-m3': [50, 278, true, 'Bluetooth 5.3', true],
  'jabra-elite-85h': [36, 296, true, 'Bluetooth 5.0', true],
  'soundcore-space-one-pro': [40, 286, true, 'Bluetooth 5.3', true],
  'microsoft-surface-headphones-2-plus': [18, 290, true, 'Bluetooth 5.0', true],
} as const;

const attributeSlugs = [
  'battery-life',
  'weight',
  'bluetooth',
  'connection-type',
  'noise-cancelling',
] as const;

export const productSpecificationsSeedData = Object.entries(
  headphoneSpecifications,
).flatMap(([productSlug, values]) =>
  attributeSlugs.map((attributeSlug, index) => ({
    productSlug,
    attributeSlug,
    value: values[index],
  })),
);
