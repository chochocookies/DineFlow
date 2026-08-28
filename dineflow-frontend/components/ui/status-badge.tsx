import { statusLabel } from "@/lib/format";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

const orderStatusClasses: Record<OrderStatus, string> = {
  pending: "bg-secondary-tint text-secondary",
  confirmed: "bg-secondary-tint text-secondary",
  preparing: "bg-secondary-tint text-secondary",
  ready: "bg-success-tint text-success",
  served: "bg-success-tint text-success",
  completed: "bg-success-tint text-success",
  cancelled: "bg-danger-tint text-danger",
};

const paymentStatusClasses: Record<PaymentStatus, string> = {
  unpaid: "bg-danger-tint text-danger",
  pending: "bg-secondary-tint text-secondary",
  paid: "bg-success-tint text-success",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${orderStatusClasses[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${paymentStatusClasses[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}
