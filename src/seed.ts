import 'reflect-metadata';
import { AppDataSource } from './database/data-source';
import { Coupon } from './entities/coupon.entity';
import { Product } from './entities/product.entity';
import { ProductPrice } from './entities/product-price.entity';

/**
 * Seed data — run with `npm run seed` (after migrations).
 *
 * The 7 services and prices below are the owner's STARTING prices: they
 * match the approved Phase 1 design and the Flutter app's fallback
 * catalogue (PVC Photo ID Card ₹99 + ₹49 delivery, etc.). They are
 * editable defaults — change them any time from the Admin Dashboard
 * (Admin → Products); never edit this file to change live prices.
 * All amounts are integer paise (₹99 = 9900).
 *
 * The seed is idempotent: products are matched by slug and updated,
 * prices are replaced, and the WELCOME10 coupon is upserted.
 */
interface SeedPrice {
  option_label: string;
  price_paise: number;
  delivery_charge_paise: number;
  min_qty?: number;
}

interface SeedProduct {
  name: string;
  slug: string;
  description: string;
  category: string;
  sort_order: number;
  prices: SeedPrice[];
}

const CATALOGUE: SeedProduct[] = [
  {
    name: 'PVC Photo ID Card Printing',
    slug: 'pvc-photo-id-card',
    description:
      'Durable PVC photo ID card, printed in high quality with a glossy finish. Upload a clear front photo (and back photo for the front + back option). Only lawful, authorised ID printing — we do not print counterfeit government ID cards.',
    category: 'pvc_card',
    sort_order: 1,
    prices: [
      { option_label: 'Single Side', price_paise: 9900, delivery_charge_paise: 4900 },
      { option_label: 'Front + Back', price_paise: 14900, delivery_charge_paise: 4900 },
    ],
  },
  {
    name: 'Passport Size Photo Printing',
    slug: 'passport-size-photo',
    description:
      'Passport size photos (35 × 45 mm) printed on premium glossy photo paper. Upload one clear front-facing photo; we crop and print it to the standard passport size.',
    category: 'passport_photo',
    sort_order: 2,
    prices: [
      { option_label: '8 Copies', price_paise: 9900, delivery_charge_paise: 4900 },
      { option_label: '16 Copies', price_paise: 14900, delivery_charge_paise: 4900 },
      { option_label: '32 Copies', price_paise: 24900, delivery_charge_paise: 4900 },
    ],
  },
  {
    name: 'Photo Printing',
    slug: 'photo-printing',
    description:
      'Your favourite photos printed on premium glossy photo paper with rich, lasting colours. Upload JPG or PNG photos.',
    category: 'photo_print',
    sort_order: 3,
    prices: [
      { option_label: '4 × 6 inch (per photo)', price_paise: 1500, delivery_charge_paise: 4900 },
      { option_label: '5 × 7 inch (per photo)', price_paise: 2500, delivery_charge_paise: 4900 },
      { option_label: '8 × 12 inch (per photo)', price_paise: 7900, delivery_charge_paise: 4900 },
    ],
  },
  {
    name: 'Document Printing',
    slug: 'document-printing',
    description:
      'Clear, sharp document printing on quality A4 paper. Upload your documents as PDF or images; price is per page.',
    category: 'document_print',
    sort_order: 4,
    prices: [
      { option_label: 'A4 Black & White (per page)', price_paise: 500, delivery_charge_paise: 4900 },
      { option_label: 'A4 Colour (per page)', price_paise: 1200, delivery_charge_paise: 4900 },
    ],
  },
  {
    name: 'PDF Printing',
    slug: 'pdf-printing',
    description:
      'Print complete PDF files — notes, e-books, forms and study material — bound-quality A4 printing, priced per page.',
    category: 'pdf_print',
    sort_order: 5,
    prices: [
      { option_label: 'A4 Black & White (per page)', price_paise: 500, delivery_charge_paise: 4900 },
      { option_label: 'A4 Colour (per page)', price_paise: 1200, delivery_charge_paise: 4900 },
    ],
  },
  {
    name: 'Bulk Printing Orders',
    slug: 'bulk-printing',
    description:
      'Bulk printing for shops, schools, coaching centres and offices. Best per-page rates on large quantities (minimum 100 pages). Upload your files and we will confirm the order on call before printing.',
    category: 'bulk',
    sort_order: 6,
    prices: [
      { option_label: 'A4 Black & White (per page)', price_paise: 300, delivery_charge_paise: 9900, min_qty: 100 },
      { option_label: 'A4 Colour (per page)', price_paise: 800, delivery_charge_paise: 9900, min_qty: 100 },
    ],
  },
  {
    name: 'Sarkari Form Seva — Form Bharai + Print',
    slug: 'sarkari-form-seva',
    description:
      'Government form filling + printing service. Upload the applicant\'s documents, we fill the government form online, print it and deliver it to your address. Your documents are used ONLY for your form work and are never shared for any other purpose. For some forms an OTP comes on the applicant\'s mobile — our team will call to take the OTP while filling the form. Sarkari (government) fees, if any, are charged separately at actuals.',
    category: 'form_seva',
    sort_order: 7,
    prices: [
      { option_label: 'Ration Card / Jan Aadhaar Form', price_paise: 9900, delivery_charge_paise: 4900, min_qty: 1 },
      { option_label: 'Labour Card (BOCW) Form', price_paise: 9900, delivery_charge_paise: 4900, min_qty: 1 },
      { option_label: 'Caste / Income / Domicile Certificate', price_paise: 9900, delivery_charge_paise: 4900, min_qty: 1 },
      { option_label: 'Voter ID — New / Correction', price_paise: 9900, delivery_charge_paise: 4900, min_qty: 1 },
      { option_label: 'Scholarship / Exam Form', price_paise: 9900, delivery_charge_paise: 4900, min_qty: 1 },
      { option_label: 'PAN Card Apply', price_paise: 9900, delivery_charge_paise: 4900, min_qty: 1 },
      { option_label: 'Any Other Sarkari Form', price_paise: 9900, delivery_charge_paise: 4900, min_qty: 1 },
    ],
  },
];

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const productRepo = AppDataSource.getRepository(Product);
    const priceRepo = AppDataSource.getRepository(ProductPrice);
    const couponRepo = AppDataSource.getRepository(Coupon);

    for (const item of CATALOGUE) {
      let product = await productRepo.findOne({
        where: { slug: item.slug },
        relations: { prices: true },
      });
      if (!product) {
        product = productRepo.create({
          name: item.name,
          slug: item.slug,
          description: item.description,
          category: item.category,
          sortOrder: item.sort_order,
          isActive: true,
          imageUrl: null,
        });
      } else {
        product.name = item.name;
        product.description = item.description;
        product.category = item.category;
        product.sortOrder = item.sort_order;
        product.isActive = true;
      }
      product = await productRepo.save(product);

      await priceRepo.delete({ productId: product.id });
      const prices = item.prices.map((p) =>
        priceRepo.create({
          productId: product.id,
          optionLabel: p.option_label,
          pricePaise: p.price_paise,
          deliveryChargePaise: p.delivery_charge_paise,
          minQty: p.min_qty ?? 1,
        }),
      );
      await priceRepo.save(prices);
      // eslint-disable-next-line no-console
      console.log(`Seeded product: ${item.name} (${prices.length} prices)`);
    }

    let coupon = await couponRepo.findOne({ where: { code: 'WELCOME10' } });
    if (!coupon) {
      coupon = couponRepo.create({ code: 'WELCOME10' });
    }
    coupon.type = 'percent';
    coupon.value = 10;
    coupon.minOrderPaise = 0;
    coupon.maxDiscountPaise = null;
    coupon.validFrom = null;
    coupon.validTo = null;
    coupon.isActive = true;
    await couponRepo.save(coupon);
    // eslint-disable-next-line no-console
    console.log('Seeded coupon: WELCOME10 (10% off)');

    // eslint-disable-next-line no-console
    console.log('Seed complete.');
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
