import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ProductPriceRange,
  ProductSearchItemDto,
  ProductSearchQueryDto,
  ProductSearchResponseDto,
  ProductSearchSort,
} from './dto';

type OmittedFacet = 'category' | 'feature' | 'price' | null;

type SearchItemRow = {
  id: string;
  name: string;
  slug: string;
  model: string | null;
  description: string | null;
  createdAt: Date;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  imageId: string | null;
  imageUrl: string | null;
  imageAltText: string | null;
  price: string | null;
  currency: string | null;
  recordedAt: Date | null;
};

type CountRow = { count: string };
type FacetRow = { id: string; name: string; count: string };
type PriceFacetRow = {
  id: ProductPriceRange;
  label: string;
  count: string;
};

class SqlParameters {
  readonly values: unknown[] = [];

  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

const SEARCH_CTE = `
WITH RECURSIVE category_closure AS (
  SELECT id AS ancestor_id, id AS descendant_id
  FROM categories
  WHERE deleted_at IS NULL
  UNION ALL
  SELECT closure.ancestor_id, child.id
  FROM category_closure closure
  JOIN categories child ON child.parent_id = closure.descendant_id
  WHERE child.deleted_at IS NULL
), enriched AS (
  SELECT
    product.id,
    product.name,
    product.slug,
    product.model,
    product.description,
    product.created_at,
    brand.id AS brand_id,
    brand.name AS brand_name,
    category.id AS category_id,
    category.name AS category_name,
    image.id AS image_id,
    image.url AS image_url,
    image.alt_text AS image_alt_text,
    visible_price.price,
    visible_price.currency,
    visible_price.recorded_at,
    usd_price.price AS usd_price
  FROM products product
  JOIN brands brand
    ON brand.id = product.brand_id AND brand.deleted_at IS NULL
  JOIN categories category
    ON category.id = product.category_id AND category.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT product_image.id, product_image.url, product_image.alt_text
    FROM product_images product_image
    WHERE product_image.product_id = product.id
      AND product_image.deleted_at IS NULL
    ORDER BY product_image.position ASC, product_image.id ASC
    LIMIT 1
  ) image ON TRUE
  LEFT JOIN LATERAL (
    SELECT product_price.price, product_price.currency, product_price.recorded_at
    FROM product_prices product_price
    WHERE product_price.product_id = product.id
      AND product_price.deleted_at IS NULL
    ORDER BY product_price.recorded_at DESC, product_price.id DESC
    LIMIT 1
  ) visible_price ON TRUE
  LEFT JOIN LATERAL (
    SELECT product_price.price
    FROM product_prices product_price
    WHERE product_price.product_id = product.id
      AND product_price.deleted_at IS NULL
      AND product_price.currency = 'USD'
    ORDER BY product_price.recorded_at DESC, product_price.id DESC
    LIMIT 1
  ) usd_price ON TRUE
  WHERE product.deleted_at IS NULL
)
`;

const PRICE_RANGE_SQL = `
  (
    (range.id = '<500' AND enriched.usd_price < 500) OR
    (range.id = '500-999.99' AND enriched.usd_price >= 500 AND enriched.usd_price < 1000) OR
    (range.id = '1000-1499.99' AND enriched.usd_price >= 1000 AND enriched.usd_price < 1500) OR
    (range.id = '>=1500' AND enriched.usd_price >= 1500)
  )
`;

@Injectable()
export class ProductSearchService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async search(
    query: ProductSearchQueryDto,
  ): Promise<ProductSearchResponseDto> {
    const itemsSql = this.buildItemsQuery(query);
    const totalSql = this.buildTotalQuery(query);
    const categorySql = this.buildCategoryFacetsQuery(query);
    const priceSql = this.buildPriceFacetsQuery(query);
    const featureSql = this.buildFeatureFacetsQuery(query);

    const [
      itemsResult,
      totalResult,
      categoriesResult,
      pricesResult,
      featuresResult,
    ] = await Promise.all([
      this.execute<SearchItemRow>(itemsSql.text, itemsSql.parameters),
      this.execute<CountRow>(totalSql.text, totalSql.parameters),
      this.execute<FacetRow>(categorySql.text, categorySql.parameters),
      this.execute<PriceFacetRow>(priceSql.text, priceSql.parameters),
      this.execute<FacetRow>(featureSql.text, featureSql.parameters),
    ]);

    const items = itemsResult;
    const totalRows = totalResult;
    const categoryRows = categoriesResult;
    const priceRows = pricesResult;
    const featureRows = featuresResult;

    return {
      items: items.map((row) => this.toItem(row)),
      facets: {
        categories: categoryRows.map((row) => ({
          id: row.id,
          name: row.name,
          count: Number(row.count),
        })),
        prices: priceRows.map((row) => ({
          id: row.id,
          label: row.label,
          count: Number(row.count),
        })),
        features: featureRows.map((row) => ({
          id: row.id,
          name: row.name,
          count: Number(row.count),
        })),
      },
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: Number(totalRows[0]?.count ?? 0),
      },
    };
  }

  private async execute<TRow>(
    sql: string,
    parameters: unknown[],
  ): Promise<TRow[]> {
    const result = (await this.dataSource.query(sql, parameters)) as unknown;
    return result as TRow[];
  }

  private buildItemsQuery(query: ProductSearchQueryDto) {
    const parameters = new SqlParameters();
    const where = this.buildFilters(query, parameters, null);
    const limit = parameters.add(query.limit);
    const offset = parameters.add(query.offset);
    const order = this.buildOrder(query, parameters);

    return {
      text: `${SEARCH_CTE}
        SELECT
          enriched.id,
          enriched.name,
          enriched.slug,
          enriched.model,
          enriched.description,
          enriched.created_at AS "createdAt",
          enriched.brand_id AS "brandId",
          enriched.brand_name AS "brandName",
          enriched.category_id AS "categoryId",
          enriched.category_name AS "categoryName",
          enriched.image_id AS "imageId",
          enriched.image_url AS "imageUrl",
          enriched.image_alt_text AS "imageAltText",
          enriched.price,
          enriched.currency,
          enriched.recorded_at AS "recordedAt"
        FROM enriched
        WHERE ${where}
        ORDER BY ${order}
        LIMIT ${limit} OFFSET ${offset}`,
      parameters: parameters.values,
    };
  }

  private buildTotalQuery(query: ProductSearchQueryDto) {
    const parameters = new SqlParameters();
    const where = this.buildFilters(query, parameters, null);

    return {
      text: `${SEARCH_CTE}
        SELECT COUNT(*)::text AS count
        FROM enriched
        WHERE ${where}`,
      parameters: parameters.values,
    };
  }

  private buildCategoryFacetsQuery(query: ProductSearchQueryDto) {
    const parameters = new SqlParameters();
    const where = this.buildFilters(query, parameters, 'category');

    return {
      text: `${SEARCH_CTE}
        SELECT
          category.id,
          category.name,
          (
            SELECT COUNT(DISTINCT enriched.id)::text
            FROM enriched
            WHERE ${where}
              AND EXISTS (
                SELECT 1
                FROM category_closure closure
                WHERE closure.ancestor_id = category.id
                  AND closure.descendant_id = enriched.category_id
              )
          ) AS count
        FROM categories category
        WHERE category.deleted_at IS NULL
        ORDER BY category.name ASC, category.id ASC`,
      parameters: parameters.values,
    };
  }

  private buildPriceFacetsQuery(query: ProductSearchQueryDto) {
    const parameters = new SqlParameters();
    const where = this.buildFilters(query, parameters, 'price');

    return {
      text: `${SEARCH_CTE}, ranges(id, label, position) AS (
          VALUES
            ('<500', 'Menos de USD 500', 1),
            ('500-999.99', 'USD 500 a 999,99', 2),
            ('1000-1499.99', 'USD 1.000 a 1.499,99', 3),
            ('>=1500', 'USD 1.500 o más', 4)
        )
        SELECT
          range.id,
          range.label,
          (
            SELECT COUNT(*)::text
            FROM enriched
            WHERE ${where} AND ${PRICE_RANGE_SQL}
          ) AS count
        FROM ranges range
        ORDER BY range.position`,
      parameters: parameters.values,
    };
  }

  private buildFeatureFacetsQuery(query: ProductSearchQueryDto) {
    const parameters = new SqlParameters();
    const where = this.buildFilters(query, parameters, 'feature');

    return {
      text: `${SEARCH_CTE}
        SELECT
          attribute.id,
          attribute.name,
          (
            SELECT COUNT(DISTINCT enriched.id)::text
            FROM enriched
            JOIN product_specifications specification
              ON specification.product_id = enriched.id
              AND specification.attribute_id = attribute.id
              AND specification.boolean_value = TRUE
              AND specification.deleted_at IS NULL
            WHERE ${where}
          ) AS count
        FROM attributes attribute
        WHERE attribute.deleted_at IS NULL
          AND attribute.data_type = 'boolean'
        ORDER BY attribute.name ASC, attribute.id ASC`,
      parameters: parameters.values,
    };
  }

  private buildFilters(
    query: ProductSearchQueryDto,
    parameters: SqlParameters,
    omittedFacet: OmittedFacet,
  ): string {
    const filters: string[] = ['TRUE'];

    if (query.q) {
      const search = parameters.add(`%${query.q}%`);
      filters.push(`(
        enriched.name ILIKE ${search} OR
        COALESCE(enriched.model, '') ILIKE ${search} OR
        enriched.brand_name ILIKE ${search}
      )`);
    }

    if (omittedFacet !== 'category' && query.categoryId?.length) {
      const categoryIds = parameters.add(query.categoryId);
      filters.push(`EXISTS (
        SELECT 1
        FROM category_closure closure
        WHERE closure.ancestor_id = ANY(${categoryIds}::uuid[])
          AND closure.descendant_id = enriched.category_id
      )`);
    }

    if (omittedFacet !== 'price' && query.priceRange?.length) {
      const ranges = parameters.add(query.priceRange);
      filters.push(`(
        ('<500' = ANY(${ranges}::text[]) AND enriched.usd_price < 500) OR
        ('500-999.99' = ANY(${ranges}::text[]) AND enriched.usd_price >= 500 AND enriched.usd_price < 1000) OR
        ('1000-1499.99' = ANY(${ranges}::text[]) AND enriched.usd_price >= 1000 AND enriched.usd_price < 1500) OR
        ('>=1500' = ANY(${ranges}::text[]) AND enriched.usd_price >= 1500)
      )`);
    }

    if (omittedFacet !== 'feature' && query.featureId?.length) {
      const featureIds = parameters.add(query.featureId);
      filters.push(`(
        SELECT COUNT(DISTINCT specification.attribute_id)
        FROM product_specifications specification
        WHERE specification.product_id = enriched.id
          AND specification.deleted_at IS NULL
          AND specification.boolean_value = TRUE
          AND specification.attribute_id = ANY(${featureIds}::uuid[])
      ) = cardinality(${featureIds}::uuid[])`);
    }

    return filters.join('\nAND ');
  }

  private buildOrder(
    query: ProductSearchQueryDto,
    parameters: SqlParameters,
  ): string {
    if (query.sort === ProductSearchSort.NAME_DESC) {
      return 'enriched.name DESC, enriched.id ASC';
    }
    if (query.sort === ProductSearchSort.PRICE_ASC) {
      return 'enriched.usd_price ASC NULLS LAST, enriched.name ASC, enriched.id ASC';
    }
    if (query.sort === ProductSearchSort.PRICE_DESC) {
      return 'enriched.usd_price DESC NULLS LAST, enriched.name ASC, enriched.id ASC';
    }
    if (query.sort === ProductSearchSort.NEWEST) {
      return 'enriched.created_at DESC, enriched.id DESC';
    }
    if (query.sort === ProductSearchSort.RELEVANCE && query.q) {
      const exact = parameters.add(query.q);
      const prefix = parameters.add(`${query.q}%`);
      return `CASE
          WHEN LOWER(enriched.name) = LOWER(${exact}) THEN 0
          WHEN LOWER(COALESCE(enriched.model, '')) = LOWER(${exact}) THEN 1
          WHEN enriched.name ILIKE ${prefix} THEN 2
          WHEN COALESCE(enriched.model, '') ILIKE ${prefix} THEN 3
          WHEN enriched.brand_name ILIKE ${prefix} THEN 4
          ELSE 5
        END ASC, enriched.name ASC, enriched.id ASC`;
    }

    return 'enriched.name ASC, enriched.id ASC';
  }

  private toItem(row: SearchItemRow): ProductSearchItemDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      model: row.model,
      description: row.description,
      createdAt: row.createdAt,
      brand: { id: row.brandId, name: row.brandName },
      category: { id: row.categoryId, name: row.categoryName },
      image:
        row.imageId && row.imageUrl
          ? { id: row.imageId, url: row.imageUrl, altText: row.imageAltText }
          : null,
      price:
        row.price !== null && row.currency && row.recordedAt
          ? {
              price: Number(row.price),
              currency: row.currency,
              recordedAt: row.recordedAt,
            }
          : null,
    };
  }
}
