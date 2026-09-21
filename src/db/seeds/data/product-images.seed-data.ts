import { productsSeedData } from './products.seed-data';

export const productImagesSeedData = productsSeedData.flatMap((product) => [
  {
    productSlug: product.slug,
    url: `https://cdn.example.com/products/${product.slug}-front.jpg`,
    altText: `${product.name} front view`,
    position: 0,
  },
  {
    productSlug: product.slug,
    url: `https://cdn.example.com/products/${product.slug}-side.jpg`,
    altText: `${product.name} side view`,
    position: 1,
  },
]);
