import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../entities/product.entity';
import { ProductPrice } from '../../entities/product-price.entity';

export interface ProductInput {
  name: string;
  slug?: string;
  description?: string | null;
  image_url?: string | null;
  category: string;
  is_active?: boolean;
  sort_order?: number;
  prices?: PriceInput[];
}

export interface PriceInput {
  id?: string;
  option_label: string;
  price_paise: number;
  delivery_charge_paise?: number;
  min_qty?: number;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(ProductPrice)
    private readonly prices: Repository<ProductPrice>,
  ) {}

  /** Public catalogue: active products only, with their price options. */
  listActive(): Promise<Product[]> {
    return this.products.find({
      where: { isActive: true },
      relations: { prices: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async getBySlug(slug: string): Promise<Product> {
    const product = await this.products.findOne({
      where: { slug },
      relations: { prices: true },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found.');
    }
    return product;
  }

  findById(id: string, withPrices = false): Promise<Product | null> {
    return this.products.findOne({
      where: { id },
      relations: withPrices ? { prices: true } : undefined,
    });
  }

  // ---------------- Admin management ----------------

  listAll(): Promise<Product[]> {
    return this.products.find({
      relations: { prices: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async create(input: ProductInput): Promise<Product> {
    const product = this.products.create({
      name: input.name,
      slug: input.slug ?? slugify(input.name),
      description: input.description ?? null,
      imageUrl: input.image_url ?? null,
      category: input.category,
      isActive: input.is_active ?? true,
      sortOrder: input.sort_order ?? 0,
      prices: (input.prices ?? []).map((p) =>
        this.prices.create({
          optionLabel: p.option_label,
          pricePaise: p.price_paise,
          deliveryChargePaise: p.delivery_charge_paise ?? 0,
          minQty: p.min_qty ?? 1,
        }),
      ),
    });
    return this.products.save(product);
  }

  async update(id: string, input: Partial<ProductInput>): Promise<Product> {
    const product = await this.findById(id, true);
    if (!product) throw new NotFoundException('Product not found.');
    if (input.name !== undefined) product.name = input.name;
    if (input.slug !== undefined) product.slug = input.slug;
    if (input.description !== undefined) product.description = input.description;
    if (input.image_url !== undefined) product.imageUrl = input.image_url;
    if (input.category !== undefined) product.category = input.category;
    if (input.is_active !== undefined) product.isActive = input.is_active;
    if (input.sort_order !== undefined) product.sortOrder = input.sort_order;
    await this.products.save(product);

    if (input.prices !== undefined) {
      // Replace the price set wholesale: simpler and predictable for the
      // admin UI. Old order_items keep their copied unit_price_paise, so
      // history is unaffected.
      await this.prices.delete({ productId: id });
      const rows = input.prices.map((p) =>
        this.prices.create({
          productId: id,
          optionLabel: p.option_label,
          pricePaise: p.price_paise,
          deliveryChargePaise: p.delivery_charge_paise ?? 0,
          minQty: p.min_qty ?? 1,
        }),
      );
      await this.prices.save(rows);
    }
    const fresh = await this.findById(id, true);
    return fresh as Product;
  }

  /** DELETE deactivates — products are never hard-deleted, so old orders keep their references. */
  async deactivate(id: string): Promise<Product> {
    const product = await this.findById(id, true);
    if (!product) throw new NotFoundException('Product not found.');
    product.isActive = false;
    return this.products.save(product);
  }
}
