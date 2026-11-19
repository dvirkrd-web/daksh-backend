import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Google Sign-In accounts are created with email only — the mobile is
 * collected later, at order time. Postgres UNIQUE still applies to the
 * mobiles that are present (multiple NULLs are allowed), so OTP-login
 * behaviour is unchanged.
 */
export class MakeUserMobileNullable1795087523965 implements MigrationInterface {
  name = 'MakeUserMobileNullable1795087523965';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "mobile" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "mobile" SET NOT NULL`,
    );
  }
}
