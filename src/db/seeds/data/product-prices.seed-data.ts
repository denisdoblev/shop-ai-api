const priceHistory = {
  'sony-wh-1000xm6': ['399.99', '349.99'],
  'bose-quietcomfort-ultra-headphones': ['429.99', '379.99'],
  'apple-airpods-max': ['549.99', '499.99'],
  'sennheiser-momentum-4-wireless': ['379.99', '329.99'],
  'beats-studio-pro': ['349.99', '299.99'],
  'jbl-tour-one-m3': ['399.99', '359.99'],
  'jabra-elite-85h': ['249.99', '199.99'],
  'soundcore-space-one-pro': ['199.99', '169.99'],
  'microsoft-surface-headphones-2-plus': ['299.99', '269.99'],
} as const;

export const productPricesSeedData = Object.entries(priceHistory).flatMap(
  ([productSlug, prices]) => [
    {
      productSlug,
      price: prices[0],
      currency: 'USD',
      recordedAt: '2026-01-15T00:00:00.000Z',
    },
    {
      productSlug,
      price: prices[1],
      currency: 'USD',
      recordedAt: '2026-06-15T00:00:00.000Z',
    },
  ],
);
