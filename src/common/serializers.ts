import { Address } from '../entities/address.entity';
import { Order } from '../entities/order.entity';
import { Product } from '../entities/product.entity';
import { ProductPrice } from '../entities/product-price.entity';
import { SupportTicket } from '../entities/support-ticket.entity';
import { UploadedFile } from '../entities/uploaded-file.entity';
import { User } from '../entities/user.entity';

/**
 * Response serializers. Field names are snake_case and match the Flutter
 * app's fromJson models exactly (customer-app/lib/models/*) — the app is
 * the client contract.
 */

export function serializeUser(user: User) {
  return {
    id: user.id,
    mobile: user.mobile,
    name: user.name,
    email: user.email,
    is_active: user.isActive,
    last_login_at: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    created_at: user.createdAt ? user.createdAt.toISOString() : null,
  };
}

export function serializeAddress(address: Address) {
  return {
    id: address.id,
    full_name: address.fullName,
    mobile: address.mobile,
    house_no: address.houseNo,
    street: address.street,
    village_city: address.villageCity,
    district: address.district,
    state: address.state,
    pin_code: address.pinCode,
    is_default: address.isDefault,
  };
}

export function serializePrice(price: ProductPrice) {
  return {
    id: price.id,
    product_id: price.productId,
    option_label: price.optionLabel,
    price_paise: price.pricePaise,
    delivery_charge_paise: price.deliveryChargePaise,
    min_qty: price.minQty,
  };
}

export function serializeProduct(product: Product) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description ?? '',
    image_url: product.imageUrl,
    category: product.category,
    is_active: product.isActive,
    sort_order: product.sortOrder,
    prices: (product.prices ?? []).map(serializePrice),
  };
}

export function serializeUploadedFile(file: UploadedFile) {
  return {
    id: file.id,
    storage_key: file.storageKey,
    original_name: file.originalName,
    mime_type: file.mimeType,
    // bigint column — always emit a JSON number for the app.
    size_bytes: Number(file.sizeBytes),
    side: file.side,
    created_at: file.createdAt ? file.createdAt.toISOString() : null,
  };
}

export function serializeOrder(order: Order, opts?: { admin?: boolean }) {
  const items = (order.items ?? []).map((item) => ({
    id: item.id,
    product_id: item.productId,
    price_id: item.priceId,
    product_name: item.product ? item.product.name : null,
    option_label: item.price ? item.price.optionLabel : null,
    qty: item.qty,
    unit_price_paise: item.unitPricePaise,
    options: item.options ?? {},
    files: (item.files ?? []).map(serializeUploadedFile),
  }));

  const history = [...(order.statusHistory ?? [])]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((entry) => ({
      status: entry.status,
      changed_by: entry.changedBy,
      note: entry.note,
      created_at: entry.createdAt ? entry.createdAt.toISOString() : null,
    }));

  const shipment = order.shipment
    ? {
        awb_code: order.shipment.awbCode,
        courier_name: order.shipment.courierName,
        tracking_url: order.shipment.trackingUrl,
        current_status: order.shipment.currentStatus,
        etd: order.shipment.etd ? order.shipment.etd.toISOString() : null,
      }
    : null;

  return {
    id: order.id,
    order_no: order.orderNo,
    status: order.status,
    subtotal_paise: order.subtotalPaise,
    delivery_paise: order.deliveryPaise,
    discount_paise: order.discountPaise,
    total_paise: order.totalPaise,
    customer_note: order.customerNote,
    // internal_note is admin-only information; never send it to customers.
    ...(opts?.admin ? { internal_note: order.internalNote } : {}),
    items,
    status_history: history,
    shipment,
    address: order.address ? serializeAddress(order.address) : null,
    created_at: order.createdAt ? order.createdAt.toISOString() : null,
  };
}

export function serializeTicket(ticket: SupportTicket) {
  return {
    id: ticket.id,
    subject: ticket.subject,
    message: ticket.message,
    status: ticket.status,
    admin_reply: ticket.adminReply,
    order_id: ticket.orderId,
    created_at: ticket.createdAt ? ticket.createdAt.toISOString() : null,
  };
}
