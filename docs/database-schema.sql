-- ============================================================
-- BRANDS
-- ============================================================

CREATE TABLE brands (
    id UUID NOT NULL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    logo_url TEXT NULL,

    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP NULL
);


-- ============================================================
-- CATEGORIES
-- ============================================================

CREATE TABLE categories (
    id UUID NOT NULL PRIMARY KEY,

    parent_id UUID NULL,

    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description TEXT NULL,

    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_categories_parent
        FOREIGN KEY (parent_id)
        REFERENCES categories(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_categories_not_self_parent
        CHECK (parent_id IS NULL OR parent_id <> id)
);


-- ============================================================
-- ATTRIBUTES
-- ============================================================

CREATE TABLE attributes (
    id UUID NOT NULL PRIMARY KEY,

    name VARCHAR(150) NOT NULL,
    slug VARCHAR(160) NOT NULL,

    data_type VARCHAR(20) NOT NULL,
    unit VARCHAR(50) NULL,

    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT chk_attributes_data_type
        CHECK (
            data_type IN ('string', 'number', 'boolean')
        )
);


-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE products (
    id UUID NOT NULL PRIMARY KEY,

    brand_id UUID NOT NULL,
    category_id UUID NOT NULL,

    name VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL,
    model VARCHAR(150) NULL,
    description TEXT NULL,

    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_products_brand
        FOREIGN KEY (brand_id)
        REFERENCES brands(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE RESTRICT
);


-- ============================================================
-- CATEGORY ATTRIBUTES
-- ============================================================
--
-- Defines the suggested/default attributes for each category.
-- It acts as a template, NOT as a restriction.
--
-- Example:
--
-- Headphones
--   -> Battery Life
--   -> Bluetooth
--   -> Weight
--   -> Microphone
--
-- A product can still have attributes that are not included
-- in this table.
-- ============================================================

CREATE TABLE category_attributes (
    id UUID NOT NULL PRIMARY KEY,

    category_id UUID NOT NULL,
    attribute_id UUID NOT NULL,

    position INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_category_attributes_category
        FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_category_attributes_attribute
        FOREIGN KEY (attribute_id)
        REFERENCES attributes(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_category_attributes_position
        CHECK (position >= 0)
);


-- ============================================================
-- PRODUCT IMAGES
-- ============================================================

CREATE TABLE product_images (
    id UUID NOT NULL PRIMARY KEY,

    product_id UUID NOT NULL,

    url TEXT NOT NULL,
    alt_text VARCHAR(255) NULL,
    position INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_product_images_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_product_images_position
        CHECK (position >= 0)
);


-- ============================================================
-- PRODUCT SPECIFICATIONS
-- ============================================================
--
-- EAV value table.
--
-- Depending on attributes.data_type, exactly one of:
--
-- string_value
-- numeric_value
-- boolean_value
--
-- must contain the value.
-- ============================================================

CREATE TABLE product_specifications (
    id UUID NOT NULL PRIMARY KEY,

    product_id UUID NOT NULL,
    attribute_id UUID NOT NULL,

    string_value TEXT NULL,
    numeric_value NUMERIC NULL,
    boolean_value BOOLEAN NULL,

    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_product_specifications_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_product_specifications_attribute
        FOREIGN KEY (attribute_id)
        REFERENCES attributes(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_product_specifications_single_value
        CHECK (
            (CASE
                WHEN string_value IS NOT NULL THEN 1
                ELSE 0
            END)
            +
            (CASE
                WHEN numeric_value IS NOT NULL THEN 1
                ELSE 0
            END)
            +
            (CASE
                WHEN boolean_value IS NOT NULL THEN 1
                ELSE 0
            END)
            = 1
        )
);


-- ============================================================
-- PRODUCT PRICES
-- ============================================================
--
-- Stores the product price history.
--
-- The current price is the latest non-deleted record
-- ordered by recorded_at.
-- ============================================================

CREATE TABLE product_prices (
    id UUID NOT NULL PRIMARY KEY,

    product_id UUID NOT NULL,

    price NUMERIC(12,2) NOT NULL,
    currency CHAR(3) NOT NULL,

    recorded_at TIMESTAMP NOT NULL,

    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT fk_product_prices_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_product_prices_price
        CHECK (price >= 0),

    CONSTRAINT chk_product_prices_currency_uppercase
        CHECK (currency = UPPER(currency))
);


-- ============================================================
-- UNIQUE INDEXES
-- ============================================================
--
-- Partial unique indexes are used instead of regular UNIQUE
-- constraints so soft-deleted records don't block new records.
-- ============================================================


-- ------------------------------------------------------------
-- Brands
-- ------------------------------------------------------------

CREATE UNIQUE INDEX uq_brands_name_active
    ON brands(LOWER(name))
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_brands_slug_active
    ON brands(slug)
    WHERE deleted_at IS NULL;


-- ------------------------------------------------------------
-- Categories
-- ------------------------------------------------------------

CREATE UNIQUE INDEX uq_categories_slug_active
    ON categories(slug)
    WHERE deleted_at IS NULL;


-- ------------------------------------------------------------
-- Attributes
-- ------------------------------------------------------------

CREATE UNIQUE INDEX uq_attributes_slug_active
    ON attributes(slug)
    WHERE deleted_at IS NULL;


-- ------------------------------------------------------------
-- Products
-- ------------------------------------------------------------

CREATE UNIQUE INDEX uq_products_slug_active
    ON products(slug)
    WHERE deleted_at IS NULL;


-- ------------------------------------------------------------
-- Category attributes
-- ------------------------------------------------------------

CREATE UNIQUE INDEX uq_category_attribute_active
    ON category_attributes(category_id, attribute_id)
    WHERE deleted_at IS NULL;


-- ------------------------------------------------------------
-- Product specifications
-- ------------------------------------------------------------

CREATE UNIQUE INDEX uq_product_specification_active
    ON product_specifications(product_id, attribute_id)
    WHERE deleted_at IS NULL;


-- ------------------------------------------------------------
-- Product images
-- ------------------------------------------------------------

CREATE UNIQUE INDEX uq_product_image_position_active
    ON product_images(product_id, position)
    WHERE deleted_at IS NULL;


-- ------------------------------------------------------------
-- Product prices
-- ------------------------------------------------------------

CREATE UNIQUE INDEX uq_product_price_recorded_at_active
    ON product_prices(product_id, recorded_at)
    WHERE deleted_at IS NULL;


-- ============================================================
-- QUERY / PERFORMANCE INDEXES
-- ============================================================


-- ------------------------------------------------------------
-- Product filters
-- ------------------------------------------------------------

CREATE INDEX idx_products_brand
    ON products(brand_id)
    WHERE deleted_at IS NULL;


CREATE INDEX idx_products_category
    ON products(category_id)
    WHERE deleted_at IS NULL;


-- ------------------------------------------------------------
-- EAV boolean filters
--
-- Example:
-- Bluetooth = true
-- Has microphone = true
-- ------------------------------------------------------------

CREATE INDEX idx_product_specifications_boolean
    ON product_specifications(
        attribute_id,
        boolean_value,
        product_id
    )
    WHERE deleted_at IS NULL
      AND boolean_value IS NOT NULL;


-- ------------------------------------------------------------
-- EAV numeric filters
--
-- Example:
-- Battery Life >= 30
-- Weight <= 300
-- ------------------------------------------------------------

CREATE INDEX idx_product_specifications_numeric
    ON product_specifications(
        attribute_id,
        numeric_value,
        product_id
    )
    WHERE deleted_at IS NULL
      AND numeric_value IS NOT NULL;


-- ------------------------------------------------------------
-- EAV string filters
--
-- Example:
-- Connection Type = 'USB-C'
-- ------------------------------------------------------------

CREATE INDEX idx_product_specifications_string
    ON product_specifications(
        attribute_id,
        string_value,
        product_id
    )
    WHERE deleted_at IS NULL
      AND string_value IS NOT NULL;


-- ------------------------------------------------------------
-- Product price history
--
-- Optimizes:
--
-- SELECT ...
-- FROM product_prices
-- WHERE product_id = ?
--   AND deleted_at IS NULL
-- ORDER BY recorded_at DESC
-- LIMIT 1;
--
-- And historical price queries.
-- ------------------------------------------------------------

CREATE INDEX idx_product_prices_history
    ON product_prices(
        product_id,
        recorded_at DESC
    )
    WHERE deleted_at IS NULL;
