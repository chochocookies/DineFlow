ALTER TABLE staff DROP CONSTRAINT staff_email_key;
ALTER TABLE staff ADD CONSTRAINT staff_restaurant_id_email_key UNIQUE (restaurant_id, email);
