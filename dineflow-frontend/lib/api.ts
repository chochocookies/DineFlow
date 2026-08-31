import type {
  ApiFailure,
  ApiSuccess,
  AuthResponse,
  Ingredient,
  Menu,
  Order,
  QRISCharge,
  RecipeLine,
  Restaurant,
  RestaurantTable,
  StaffPublic,
  TableWithRestaurant,
} from "./types";

// Read at call-time (not module load) so this keeps working correctly in
// both Server Components (every request) and the browser (bundled once).
function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      // Order/menu data changes in real time (WebSocket handles the live
      // updates); plain fetches should never serve a stale cached copy.
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Can't reach the DineFlow server. Is the backend running?",
      0,
    );
  }

  const json = (await res.json().catch(() => null)) as
    | ApiSuccess<T>
    | ApiFailure
    | null;

  if (!res.ok || !json || json.success === false) {
    const message = json && "message" in json ? json.message : res.statusText;
    throw new ApiError(message || "Request failed", res.status);
  }

  return (json as ApiSuccess<T>).data;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

// ---- Public, unauthenticated (customer-facing) ----

export function listRestaurants() {
  return request<Restaurant[]>("/api/v1/public/restaurants");
}

// Backs the public restaurant landing page (app/r/[restaurantId]) — name +
// description, no auth needed, same trust level as the QR ordering flow.
export function getRestaurantProfile(restaurantId: string) {
  return request<Restaurant>(`/api/v1/public/restaurants/${restaurantId}`);
}

export function getTableByQrToken(qrToken: string) {
  return request<TableWithRestaurant>(`/api/v1/public/tables/${qrToken}`);
}

export function getPublicMenus(restaurantId: string) {
  return request<Menu[]>(`/api/v1/public/restaurants/${restaurantId}/menus`);
}

export interface CreateOrderItemPayload {
  menu_id: string;
  quantity: number;
  notes?: string;
}

export function createOrder(payload: {
  qr_token: string;
  items: CreateOrderItemPayload[];
  notes?: string;
}) {
  return request<Order>("/api/v1/public/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getOrderByCode(code: string) {
  return request<Order>(`/api/v1/public/orders/${code}`);
}

export function chargeOrder(code: string) {
  return request<QRISCharge>(`/api/v1/public/orders/${code}/charge`, {
    method: "POST",
  });
}

// Dev-only shortcut for local testing: completes a QRIS charge the same
// way a real Midtrans settlement webhook would, without needing a real
// gateway or a hand-built curl request. The backend only honors this while
// PAYMENT_GATEWAY=mock (see internal/payment.Handler.SimulatePayment) —
// with a real gateway configured it 404s, so this is never a way to fake a
// real payment.
export function simulateOrderPayment(code: string) {
  return request<Order>(`/api/v1/public/orders/${code}/simulate-payment`, {
    method: "POST",
  });
}

// ---- Staff (authenticated) ----

export function login(email: string, password: string) {
  return request<AuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// Both always act on the caller's own restaurant (from the JWT) — there's
// no id parameter to get wrong. Owner-only on the backend (mirrors
// lib/permissions.ts's separate "owner only" tier, distinct from the
// owner+manager tier everything else in Settings-adjacent pages uses).
export function getMyRestaurant(token: string) {
  return request<Restaurant>("/api/v1/restaurants/me", {
    headers: authHeaders(token),
  });
}

export function updateMyRestaurant(token: string, description: string) {
  return request<Restaurant>("/api/v1/restaurants/me", {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ description }),
  });
}

export function listOrders(token: string, status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<Order[]>(`/api/v1/orders${qs}`, {
    headers: authHeaders(token),
  });
}

export function listTables(token: string) {
  return request<RestaurantTable[]>("/api/v1/tables", {
    headers: authHeaders(token),
  });
}

export function createTable(token: string, code: string) {
  return request<RestaurantTable>("/api/v1/tables", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ code }),
  });
}

export function deleteTable(token: string, id: string) {
  return request<{ deleted: boolean }>(`/api/v1/tables/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// listAllMenus (staff) differs from getPublicMenus above: it includes
// unavailable items too, since the person managing the menu needs to see
// (and re-enable) items a customer wouldn't.
export function listAllMenus(token: string) {
  return request<Menu[]>("/api/v1/menus", { headers: authHeaders(token) });
}

export interface MenuInput {
  category: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  prep_time_minutes?: number;
}

export function createMenu(token: string, input: MenuInput) {
  return request<Menu>("/api/v1/menus", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function updateMenu(
  token: string,
  id: string,
  input: Partial<MenuInput> & { is_available?: boolean },
) {
  return request<Menu>(`/api/v1/menus/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function deleteMenu(token: string, id: string) {
  return request<{ deleted: boolean }>(`/api/v1/menus/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export interface DashboardPeriod {
  order_count: number;
  total_sales: number;
  average_order: number;
}

export interface DashboardSummary {
  today: DashboardPeriod;
  this_week: DashboardPeriod;
  this_month: DashboardPeriod;
  daily_trend: { date: string; total: number }[];
}

export function getDashboardSummary(token: string) {
  return request<DashboardSummary>("/api/v1/dashboard/summary", {
    headers: authHeaders(token),
  });
}

export interface BestSeller {
  menu_id: string;
  menu_name: string;
  total_quantity: number;
  order_count: number;
}

export function getBestSellers(token: string, limit = 5) {
  return request<BestSeller[]>(`/api/v1/dashboard/best-sellers?limit=${limit}`, {
    headers: authHeaders(token),
  });
}

// ---- Staff management ----

export function listStaff(token: string) {
  return request<StaffPublic[]>("/api/v1/staff", { headers: authHeaders(token) });
}

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
  role: string;
}

export function createStaff(token: string, input: CreateStaffInput) {
  return request<StaffPublic>("/api/v1/staff", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function deleteStaff(token: string, id: string) {
  return request<{ deleted: boolean }>(`/api/v1/staff/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// ---- Inventory ----

export function listIngredients(token: string) {
  return request<Ingredient[]>("/api/v1/ingredients", { headers: authHeaders(token) });
}

export interface IngredientInput {
  name: string;
  unit: string;
  stock_quantity: number;
}

export function createIngredient(token: string, input: IngredientInput) {
  return request<Ingredient>("/api/v1/ingredients", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function updateIngredient(
  token: string,
  id: string,
  input: Partial<IngredientInput>,
) {
  return request<Ingredient>(`/api/v1/ingredients/${id}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function adjustIngredientStock(
  token: string,
  id: string,
  delta: number,
  reason?: string,
) {
  return request<Ingredient>(`/api/v1/ingredients/${id}/stock`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ delta, reason }),
  });
}

export function deleteIngredient(token: string, id: string) {
  return request<{ deleted: boolean }>(`/api/v1/ingredients/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export function getMenuRecipe(token: string, menuId: string) {
  return request<RecipeLine[]>(`/api/v1/menus/${menuId}/recipe`, {
    headers: authHeaders(token),
  });
}

export function setMenuRecipe(
  token: string,
  menuId: string,
  items: { ingredient_id: string; quantity_per_unit: number }[],
) {
  return request<{ updated: boolean }>(`/api/v1/menus/${menuId}/recipe`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ items }),
  });
}

export function updateOrderStatus(
  token: string,
  orderId: string,
  status: string,
) {
  return request<Order>(`/api/v1/orders/${orderId}/status`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
  });
}

export function updateOrderPayment(
  token: string,
  orderId: string,
  paymentStatus: string,
  paymentMethod?: string,
) {
  return request<Order>(`/api/v1/orders/${orderId}/payment`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      payment_status: paymentStatus,
      payment_method: paymentMethod,
    }),
  });
}

// ---- WebSocket ----

// Browsers can't set an Authorization header on a WebSocket handshake, so
// the JWT travels as a query param — see internal/realtime on the backend.
export function kitchenSocketUrl(token: string): string {
  const url = new URL(apiBase());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/kitchen";
  url.search = `token=${encodeURIComponent(token)}`;
  return url.toString();
}
