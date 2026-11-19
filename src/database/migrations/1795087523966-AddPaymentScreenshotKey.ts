import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UPI (manual) payments accept EITHER a 12-digit UTR or a payment
 * screenshot as proof. The screenshot is uploaded through the normal
 * uploads flow (private storage), and only its storage key is kept on
 * the payments row so the admin can open a signed URL from the order
 * detail. UTR-only rows keep screenshot_key NULL.
 */
export class AddPaymentScreenshotKey1795087523966
  implements MigrationInterface
{
  name = 'AddPaymentScreenshotKey1795087523966';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "screenshot_key" varchar(512)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN "screenshot_key"`,
    );
  }
}
