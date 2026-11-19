import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { AdminUser } from '../../entities/admin-user.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly admins: Repository<AdminUser>,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, ip?: string) {
    const admin = await this.admins.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    // Same error for unknown email and wrong password (no user enumeration).
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    admin.lastLoginAt = new Date();
    await this.admins.save(admin);
    await this.audit.record({
      adminId: admin.id,
      action: 'admin.login',
      entity: 'admin_user',
      entityId: admin.id,
      ipAddress: ip ?? null,
    });
    const token = await this.jwtService.signAsync({
      sub: admin.id,
      type: 'admin',
      role: admin.role,
      email: admin.email,
    });
    return {
      token,
      access_token: token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    };
  }
}
