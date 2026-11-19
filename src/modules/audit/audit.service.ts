import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';

export interface AuditInput {
  adminId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ipAddress?: string | null;
  details?: Record<string, unknown> | null;
}

/** Append-only audit trail for admin actions (and notable system ones). */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly logs: Repository<AuditLog>,
  ) {}

  async record(input: AuditInput): Promise<void> {
    await this.logs.save(
      this.logs.create({
        adminId: input.adminId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        ipAddress: input.ipAddress ?? null,
        details: input.details ?? null,
      }),
    );
  }
}
