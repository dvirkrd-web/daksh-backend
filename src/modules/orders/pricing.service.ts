import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon } from '../../entities/coupon.entity';
import { Product } from '../../entities/product.entity';
import { ProductPrice } from '../../entities/product-price.entity';
import { OrderItemDto } from './dto/order.dto';

export interface PricedLine {
  product: Product;
  price: ProductPrice;
  qty: number;
  options: Record<string, unknown>;
  files: NonNullable<OrderItemDto['files']>;
  lineTotalPaise: number;
}

export interface QuoteResult {
  lines: PricedLine[];
  subtotalPaise: number;
  deliveryPaise: number;
  discountPaise: number;
  totalPaise: number;
  coupon: Coupon | null;
  couponApplied: boolean;
  message: string | null;
}

/**
 * Authoritative pricing. Prices ALWAYS come from the database — any
 * amounts the app may display are estimates until this quote runs.
 */
@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(ProductPrice)
    private readonly prices: Repository<ProductPrice>,
    @InjectRepository(Coupon)
    private readonly coupons: Repository<Coupon>,
  ) {}

  async computeQuote(
    items: OrderItemDto[],
    couponCode?: string | null,
  ): Promise<QuoteResult> {
    if (!items || items.length === 0) {
      throw new BadRequestException('Your cart is empty.');
    }

    const lines: PricedLine[] = [];
    let subtotal = 0;
    let delivery = 0;

    for (const item of items) {
      const product = await this.products.findOne({
        where: { id: item.product_id },
      });
      if (!product || !product.isActive) {
        throw new BadRequestException(
          'One of the selected products is no longer available.',
        );
      }
      const price = await this.prices.findOne({
        where: { id: item.price_id, productId: item.product_id },
      });
      if (!price) {
        throw new BadRequestException(
          `Price option not found for ${product.name}. Please re-select the product.`,
        );
      }
      if (item.qty < price.minQty) {
        throw new BadRequestException(
          `${product.name} (${price.optionLabel}) requires a minimum quantity of ${price.minQty}.`,
        );
      }
      const lineTotal = price.pricePaise * item.qty;
      subtotal += lineTotal;
      // Delivery is charged once per order line (per product option), not
      // per unit — matching the approved design (₹99 item + ₹49 delivery).
      //
      // PHASE 6: this flat per-line delivery charge is replaced by the
      // live Shiprocket rate for the delivery PIN code (POST
      // /shipping/quote) once Shiprocket credentials are configured.
      delivery += price.deliveryChargePaise;
      lines.push({
        product,
        price,
        qty: item.qty,
        options: item.options ?? {},
        files: item.files ?? [],
        lineTotalPaise: lineTotal,
      });
    }

    let discount = 0;
    let coupon: Coupon | null = null;
    let couponApplied = false;
    let message: string | null = null;

    const code = (couponCode ?? '').trim().toUpperCase();
    if (code) {
      coupon = await this.coupons.findOne({ where: { code } });
      const now = new Date();
      if (!coupon || !coupon.isActive) {
        throw new BadRequestException(`Coupon ${code} is not valid.`);
      }
      if (coupon.validFrom && coupon.validFrom > now) {
        throw new BadRequestException(`Coupon ${code} is not active yet.`);
      }
      if (coupon.validTo && coupon.validTo < now) {
        throw new BadRequestException(`Coupon ${code} has expired.`);
      }
      if (subtotal < coupon.minOrderPaise) {
        throw new BadRequestException(
          `Coupon ${code} needs a minimum order of ₹${(coupon.minOrderPaise / 100).toFixed(0)}.`,
        );
      }
      if (coupon.type === 'percent') {
        discount = Math.floor((subtotal * coupon.value) / 100);
        if (coupon.maxDiscountPaise != null) {
          discount = Math.min(discount, coupon.maxDiscountPaise);
        }
      } else {
        discount = coupon.value;
      }
      discount = Math.min(discount, subtotal);
      couponApplied = discount > 0;
      message = couponApplied
        ? `Coupon ${code} applied. You saved ₹${(discount / 100).toFixed(0)}.`
        : null;
    }

    return {
      lines,
      subtotalPaise: subtotal,
      deliveryPaise: delivery,
      discountPaise: discount,
      totalPaise: subtotal + delivery - discount,
      coupon,
      couponApplied,
      message,
    };
  }
}
