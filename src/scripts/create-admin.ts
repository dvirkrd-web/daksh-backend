import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { createInterface } from 'readline';
import { AppDataSource } from '../database/data-source';
import { AdminUser } from '../entities/admin-user.entity';

/**
 * Creates the owner admin account — `npm run create-admin`.
 *
 * The password is NEVER hard-coded or stored in plain text. Provide it
 * in one of these ways:
 *   1. CLI args:  npm run create-admin -- --email you@example.com --password '...' --name 'Owner'
 *   2. Env vars:  ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in .env
 *   3. Interactive prompts (when neither of the above is given).
 *
 * Running it again with the same email updates that admin's password
 * and reactivates the account.
 */
function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    }),
  );
}

async function main(): Promise<void> {
  let email = argValue('--email') ?? process.env.ADMIN_EMAIL;
  let password = argValue('--password') ?? process.env.ADMIN_PASSWORD;
  let name = argValue('--name') ?? process.env.ADMIN_NAME;

  if (!email) email = await prompt('Admin email: ');
  if (!password) password = await prompt('Admin password (min 8 chars): ');
  if (!name) name = (await prompt('Admin name [Owner]: ')) || 'Owner';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid admin email is required.');
  }
  if (!password || password.length < 8) {
    throw new Error('Admin password must be at least 8 characters.');
  }

  await AppDataSource.initialize();
  try {
    const repo = AppDataSource.getRepository(AdminUser);
    const passwordHash = await bcrypt.hash(password, 12);
    let admin = await repo.findOne({
      where: { email: email.toLowerCase() },
    });
    if (admin) {
      admin.passwordHash = passwordHash;
      admin.name = name;
      admin.role = 'owner';
      admin.isActive = true;
      admin = await repo.save(admin);
      // eslint-disable-next-line no-console
      console.log(`Updated existing admin: ${admin.email} (role: owner)`);
    } else {
      admin = await repo.save(
        repo.create({
          email: email.toLowerCase(),
          passwordHash,
          name,
          role: 'owner',
          isActive: true,
        }),
      );
      // eslint-disable-next-line no-console
      console.log(`Created owner admin: ${admin.email}`);
    }
    // eslint-disable-next-line no-console
    console.log('Log in from the Admin Dashboard with this email + password.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('create-admin failed:', err.message ?? err);
  process.exit(1);
});
