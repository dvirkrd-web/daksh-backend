import { Address } from './address.entity';
import { AdminUser } from './admin-user.entity';
import { AuditLog } from './audit-log.entity';
import { Coupon } from './coupon.entity';
import { Notification } from './notification.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrderStatusHistory } from './order-status-history.entity';
import { OtpCode } from './otp-code.entity';
import { Payment } from './payment.entity';
import { Product } from './product.entity';
import { ProductPrice } from './product-price.entity';
import { Shipment } from './shipment.entity';
import { SupportTicket } from './support-ticket.entity';
import { UploadedFile } from './uploaded-file.entity';
import { User } from './user.entity';

export const ALL_ENTITIES = [
  User,
  Address,
  Product,
  ProductPrice,
  Order,
  OrderItem,
  UploadedFile,
  Payment,
  Shipment,
  OrderStatusHistory,
  Coupon,
  Notification,
  SupportTicket,
  AdminUser,
  AuditLog,
  OtpCode,
];

export {
  Address,
  AdminUser,
  AuditLog,
  Coupon,
  Notification,
  Order,
  OrderItem,
  OrderStatusHistory,
  OtpCode,
  Payment,
  Product,
  ProductPrice,
  Shipment,
  SupportTicket,
  UploadedFile,
  User,
};
