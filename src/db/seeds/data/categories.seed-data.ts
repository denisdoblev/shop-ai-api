export const categoriesSeedData = [
  {
    name: 'Electronics',
    slug: 'electronics',
    description: 'Electronic devices and accessories.',
    parentSlug: null,
  },
  {
    name: 'Headphones',
    slug: 'headphones',
    description: 'Over-ear and wireless headphones.',
    parentSlug: 'electronics',
  },
] as const;
