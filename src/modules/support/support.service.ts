import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket } from '../../entities/support-ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly tickets: Repository<SupportTicket>,
  ) {}

  create(userId: string, dto: CreateTicketDto): Promise<SupportTicket> {
    return this.tickets.save(
      this.tickets.create({
        userId,
        subject: dto.subject,
        message: dto.message,
        orderId: dto.order_id ?? null,
        status: 'open',
        adminReply: null,
      }),
    );
  }

  listForUser(userId: string): Promise<SupportTicket[]> {
    return this.tickets.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
