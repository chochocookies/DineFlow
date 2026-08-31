-- Default of 15 applies retroactively to existing rows too, so every menu
-- item created before this feature existed still gets a usable estimate
-- instead of 0/NULL breaking the order-tracker countdown.
ALTER TABLE menus ADD COLUMN prep_time_minutes INTEGER NOT NULL DEFAULT 15 CHECK (prep_time_minutes > 0);
