-- Nullable: unset until the order actually enters "preparing" (see
-- order.Repository.UpdateStatus), and never overwritten after that first
-- transition, so it stays a stable reference point for the customer-facing
-- cooking-time countdown even if the order's status changes again later.
ALTER TABLE orders ADD COLUMN preparing_started_at TIMESTAMPTZ;
