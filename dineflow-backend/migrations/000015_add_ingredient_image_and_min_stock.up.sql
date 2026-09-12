ALTER TABLE ingredients ADD COLUMN image_url TEXT;
-- Same precision as stock_quantity (migration 000009) so the two compare
-- cleanly. Default 0 means "no threshold set" — the dashboard's low-stock
-- widget falls back to sorting by raw stock_quantity for any ingredient
-- left at the default, same as it did before this column existed.
ALTER TABLE ingredients ADD COLUMN min_stock NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0);
