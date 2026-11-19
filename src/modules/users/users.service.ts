import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

/** Normalises an Indian mobile to the stored +91XXXXXXXXXX form. */
export function normalizeMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  return `+91${last10}`;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findByMobile(mobile: string): Promise<User | null> {
    return this.users.findOne({ where: { mobile } });
  }

  /** Creates the customer account on first OTP login (registration). */
  async findOrCreateByMobile(mobile: string): Promise<User> {
    const existing = await this.findByMobile(mobile);
    if (existing) return existing;
    return this.users.save(
      this.users.create({ mobile, isActive: true, fcmToken: null }),
    );
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email } });
  }

  /**
   * Creates the customer account on first Google Sign-In. The account
   * is keyed by email; mobile stays empty (collected at order time).
   * If the account already exists, a missing display name is filled in
   * from the Google profile.
   */
  async findOrCreateByEmail(
    email: string,
    name: string | null,
  ): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) {
      if (!existing.name && name) {
        existing.name = name;
        return this.users.save(existing);
      }
      return existing;
    }
    return this.users.save(
      this.users.create({
        email,
        name,
        mobile: null,
        isActive: true,
        fcmToken: null,
      }),
    );
  }

  async touchLastLogin(user: User): Promise<User> {
    user.lastLoginAt = new Date();
    return this.users.save(user);
  }

  async updateProfile(
    user: User,
    patch: { name?: string; email?: string; fcmToken?: string },
  ): Promise<User> {
    if (patch.name !== undefined) user.name = patch.name;
    if (patch.email !== undefined) user.email = patch.email;
    if (patch.fcmToken !== undefined) user.fcmToken = patch.fcmToken;
    return this.users.save(user);
  }
}
