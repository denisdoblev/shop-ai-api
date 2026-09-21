export const categoriesSeedData = [
  {
    name: 'Electronics',
    slug: 'electronics',
    description: 'Electronic devices and accessories.',
    parentSlug: null,
  },
  {
    name: 'Audio',
    slug: 'audio',
    description: 'Personal and home audio devices.',
    parentSlug: 'electronics',
  },
  {
    name: 'Headphones',
    slug: 'headphones',
    description: 'Over-ear and wireless headphones.',
    parentSlug: 'audio',
  },
  {
    name: 'Speakers',
    slug: 'speakers',
    description: 'Portable and home speakers.',
    parentSlug: 'audio',
  },
  {
    name: 'Wearables',
    slug: 'wearables',
    description: 'Connected personal devices and accessories.',
    parentSlug: 'electronics',
  },
] as const;
