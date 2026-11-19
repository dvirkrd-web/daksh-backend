import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema — all 15 tables from docs/DATABASE_SCHEMA.md plus the
 * otp_codes extension table and the order-number sequence
 * (DAKSH-1001, DAKSH-1002, …).
 *
 * NOTE on order_no: docs/DATABASE_SCHEMA.md shows the example format
 * "DAKSH-2026-0001"; the project instruction for Phase 3 specifies the
 * DAKSH-1001+ format, which is what this sequence implements.
 */
export class InitialSchema1763299200000 implements MigrationInterface {
  name = 'InitialSchema1763299200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS order_no_seq START WITH 1001 INCREMENT BY 1
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "mobile" varchar(15) NOT NULL UNIQUE,
        "name" varchar(120),
        "email" varchar(160),
        "is_active" boolean NOT NULL DEFAULT true,
        "last_login_at" timestamptz,
        "fcm_token" varchar(512),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "addresses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "full_name" varchar(120) NOT NULL,
        "mobile" varchar(15) NOT NULL,
        "house_no" varchar(120) NOT NULL,
        "street" varchar(200) NOT NULL,
        "village_city" varchar(120) NOT NULL,
        "district" varchar(120) NOT NULL,
        "state" varchar(120) NOT NULL,
        "pin_code" varchar(6) NOT NULL,
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_addresses_user" ON "addresses" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(160) NOT NULL,
        "slug" varchar(160) NOT NULL UNIQUE,
        "description" text,
        "image_url" varchar(512),
        "category" varchar(40) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "product_prices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "option_label" varchar(160) NOT NULL,
        "price_paise" int NOT NULL,
        "delivery_charge_paise" int NOT NULL DEFAULT 0,
        "min_qty" int NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_product_prices_product" ON "product_prices" ("product_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "coupons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(40) NOT NULL UNIQUE,
        "type" varchar(10) NOT NULL,
        "value" int NOT NULL,
        "min_order_paise" int NOT NULL DEFAULT 0,
        "max_discount_paise" int,
        "valid_from" timestamptz,
        "valid_to" timestamptz,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "admin_users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(160) NOT NULL UNIQUE,
        "password_hash" varchar(255) NOT NULL,
        "name" varchar(120) NOT NULL,
        "role" varchar(20) NOT NULL DEFAULT 'staff',
        "is_active" boolean NOT NULL DEFAULT true,
        "last_login_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_no" varchar(30) NOT NULL UNIQUE,
        "user_id" uuid NOT NULL REFERENCES "users"("id"),
        "address_id" uuid NOT NULL REFERENCES "addresses"("id"),
        "status" varchar(30) NOT NULL DEFAULT 'pending_payment',
        "subtotal_paise" int NOT NULL,
        "delivery_paise" int NOT NULL DEFAULT 0,
        "discount_paise" int NOT NULL DEFAULT 0,
        "total_paise" int NOT NULL,
        "coupon_id" uuid REFERENCES "coupons"("id"),
        "customer_note" text,
        "internal_note" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_orders_user" ON "orders" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_status" ON "orders" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_created" ON "orders" ("created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "products"("id"),
        "price_id" uuid REFERENCES "product_prices"("id"),
        "qty" int NOT NULL,
        "unit_price_paise" int NOT NULL,
        "options" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_order_items_order" ON "order_items" ("order_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "uploaded_files" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_item_id" uuid REFERENCES "order_items"("id") ON DELETE SET NULL,
        "user_id" uuid NOT NULL REFERENCES "users"("id"),
        "storage_key" varchar(512) NOT NULL UNIQUE,
        "original_name" varchar(255) NOT NULL,
        "mime_type" varchar(80) NOT NULL,
        "size_bytes" bigint NOT NULL,
        "side" varchar(10),
        "retention_delete_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_uploaded_files_user" ON "uploaded_files" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_uploaded_files_item" ON "uploaded_files" ("order_item_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "gateway" varchar(30) NOT NULL DEFAULT 'razorpay',
        "gateway_order_id" varchar(80) NOT NULL,
        "gateway_payment_id" varchar(80),
        "amount_paise" int NOT NULL,
        "method" varchar(30),
        "status" varchar(20) NOT NULL DEFAULT 'created',
        "signature_verified" boolean NOT NULL DEFAULT false,
        "webhook_payload" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_payments_order" ON "payments" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payments_gateway_order" ON "payments" ("gateway_order_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "shipments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL UNIQUE REFERENCES "orders"("id") ON DELETE CASCADE,
        "provider" varchar(30) NOT NULL DEFAULT 'shiprocket',
        "shiprocket_order_id" varchar(80),
        "shipment_id" varchar(80),
        "awb_code" varchar(80),
        "courier_name" varchar(120),
        "pickup_status" varchar(60),
        "tracking_url" varchar(512),
        "current_status" varchar(80),
        "etd" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "order_status_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "status" varchar(30) NOT NULL,
        "changed_by" varchar(20) NOT NULL,
        "admin_id" uuid REFERENCES "admin_users"("id"),
        "note" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_history_order" ON "order_status_history" ("order_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title" varchar(160) NOT NULL,
        "body" text NOT NULL,
        "type" varchar(20) NOT NULL,
        "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
        "is_read" boolean NOT NULL DEFAULT false,
        "sent_via" varchar(20),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user" ON "notifications" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "support_tickets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
        "subject" varchar(200) NOT NULL,
        "message" text NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'open',
        "admin_reply" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_tickets_user" ON "support_tickets" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "admin_id" uuid REFERENCES "admin_users"("id") ON DELETE SET NULL,
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "action" varchar(80) NOT NULL,
        "entity" varchar(60) NOT NULL,
        "entity_id" varchar(80),
        "ip_address" varchar(60),
        "details" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_created" ON "audit_logs" ("created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "otp_codes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "mobile" varchar(15) NOT NULL,
        "code_hash" varchar(128) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "attempts" int NOT NULL DEFAULT 0,
        "consumed" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_otp_mobile" ON "otp_codes" ("mobile", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'otp_codes',
      'audit_logs',
      'support_tickets',
      'notifications',
      'order_status_history',
      'shipments',
      'payments',
      'uploaded_files',
      'order_items',
      'orders',
      'admin_users',
      'coupons',
      'product_prices',
      'products',
      'addresses',
      'users',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
    await queryRunner.query(`DROP SEQUENCE IF EXISTS order_no_seq`);
  }
}
