/**
 * Order status flow (docs/DATABASE_SCHEMA.md + app models/order.dart).
 *
 * `pending_payment` is an internal, pre-confirmation state: the order row
 * is created when the Razorpay order is created, but it only becomes a
 * real customer order (`received`) after the backend verifies the payment
 * signature (or the Razorpay webhook confirms capture). It is never part
 * of the customer-facing 7-step flow and is filtered out of order lists
 * unless explicitly requested.
 */
export const OrderStatus = {
  PendingPayment: 'pending_payment',
  Received: 'received',
  Verification: 'verification',
  Printing: 'printing',
  Packed: 'packed',
  Shipped: 'shipped',
  OutForDelivery: 'out_for_delivery',
  Delivered: 'delivered',
  Cancelled: 'cancelled',
} as const;

export type OrderStatusValue =
  (typeof OrderStatus)[keyof typeof OrderStatus];

/** The customer-facing 7-step flow, in order. */
export const ORDER_FLOW: string[] = [
  OrderStatus.Received,
  OrderStatus.Verification,
  OrderStatus.Printing,
  OrderStatus.Packed,
  OrderStatus.Shipped,
  OrderStatus.OutForDelivery,
  OrderStatus.Delivered,
];

export const ALL_ORDER_STATUSES: string[] = [
  OrderStatus.PendingPayment,
  ...ORDER_FLOW,
  OrderStatus.Cancelled,
];

/**
 * Admin-driven transitions. An order moves one step forward at a time;
 * cancellation is possible until the parcel has shipped. Webhook-driven
 * courier updates (shipped / out_for_delivery / delivered) are applied by
 * the Shiprocket webhook handler, not through this map.
 */
export const ADMIN_TRANSITIONS: Record<string, string[]> = {
  [OrderStatus.Received]: [OrderStatus.Verification, OrderStatus.Cancelled],
  [OrderStatus.Verification]: [OrderStatus.Printing, OrderStatus.Cancelled],
  [OrderStatus.Printing]: [OrderStatus.Packed, OrderStatus.Cancelled],
  [OrderStatus.Packed]: [OrderStatus.Shipped, OrderStatus.Cancelled],
  [OrderStatus.Shipped]: [OrderStatus.OutForDelivery],
  [OrderStatus.OutForDelivery]: [OrderStatus.Delivered],
  [OrderStatus.Delivered]: [],
  [OrderStatus.Cancelled]: [],
  [OrderStatus.PendingPayment]: [],
};

/** Customer self-cancellation: only before printing starts. */
export const CUSTOMER_CANCELLABLE: string[] = [
  OrderStatus.Received,
  OrderStatus.Verification,
];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  [OrderStatus.Received]: 'Order Received',
  [OrderStatus.Verification]: 'Document Verification',
  [OrderStatus.Printing]: 'Printing',
  [OrderStatus.Packed]: 'Packed',
  [OrderStatus.Shipped]: 'Shipped',
  [OrderStatus.OutForDelivery]: 'Out for Delivery',
  [OrderStatus.Delivered]: 'Delivered',
  [OrderStatus.Cancelled]: 'Cancelled',
  [OrderStatus.PendingPayment]: 'Payment Pending',
};
