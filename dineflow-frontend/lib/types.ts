// Mirrors internal/entity/*.go on the backend. Keep field names identical
// (snake_case, matching the Go json tags) since these are deserialized
// directly from the API — no mapping layer in between.

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: unknown;
}

export interface ApiFailure {
  success: false;
  message: string;
}

export interface Restaurant {
  id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
}

export type TableStatus = "available" | "occupied" | "waiting_payment";

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  code: string;
  qr_token: string;
  status: TableStatus;
}

export interface TableWithRestaurant {
  table: RestaurantTable;
  restaurant_name: string;
}

export interface Menu {
  id: string;
  restaurant_id: string;
  category: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  prep_time_minutes: number;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled";

export type PaymentStatus = "unpaid" | "pending" | "paid";

export interface OrderItem {
  id: string;
  order_id: string;
  menu_id: string;
  menu_name: string;
  prep_time_minutes?: number;
  quantity: number;
  price: number;
  notes?: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  table_id: string;
  order_code: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  tax: number;
  service_fee: number;
  total: number;
  notes?: string;
  payment_method?: string;
  payment_reference?: string;
  // Set once, the first time status becomes "preparing" — see the backend
  // README's Phase 9 note. Absent until then; unchanged afterward even if
  // status changes again, so it's a stable anchor for the cooking-time
  // countdown in OrderTracker.
  preparing_started_at?: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface QRISCharge {
  order_id: string;
  qr_image_url?: string;
  qr_string?: string;
  gateway_ref?: string;
}

export interface StaffPublic {
  id: string;
  restaurant_id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  staff: StaffPublic;
}

export interface Ingredient {
  id: string;
  restaurant_id: string;
  name: string;
  unit: string;
  stock_quantity: number;
}

export interface RecipeLine {
  ingredient_id: string;
  ingredient_name?: string;
  unit?: string;
  quantity_per_unit: number;
}

// Cart line as held client-side, before an order exists on the server.
export interface CartLine {
  menu_id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

// The live events pushed down /ws/kitchen — see internal/order/service.go's
// broadcast() calls for all four. table_status_updated is the newest one:
// it fires once an order's completion/cancellation frees up its table (see
// the Phase 7 note in the backend README), carrying a RestaurantTable
// instead of an Order.
export type KitchenEvent =
  | {
      event: "new_order" | "order_status_updated" | "order_payment_updated";
      data: Order;
    }
  | {
      event: "table_status_updated";
      data: RestaurantTable;
    };
