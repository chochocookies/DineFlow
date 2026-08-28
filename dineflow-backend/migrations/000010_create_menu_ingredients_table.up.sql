CREATE TABLE IF NOT EXISTS menu_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity_per_unit NUMERIC(12, 3) NOT NULL CHECK (quantity_per_unit > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (menu_id, ingredient_id)
);

CREATE INDEX idx_menu_ingredients_menu_id ON menu_ingredients(menu_id);
