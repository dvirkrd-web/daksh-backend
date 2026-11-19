import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../common/guards/auth.guards';
import { serializeProduct } from '../../common/serializers';
import { ProductsService } from '../products/products.service';
import { AdminService } from './admin.service';
import { AuditService } from '../audit/audit.service';
import {
  AddNoteDto,
  CreateProductDto,
  ReplyTicketDto,
  UpdateOrderStatusDto,
  UpdateProductDto,
} from './dto/admin.dto';

/**
 * Admin dashboard API — every route requires an admin JWT
 * (owner / staff role). See docs/API.md "Admin" section.
 */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly productsService: ProductsService,
    private readonly audit: AuditService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  // ---------------- Orders ----------------

  @Get('orders')
  listOrders(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listOrders({
      search,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('orders/:id')
  orderDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getOrderDetail(id);
  }

  @Patch('orders/:id/status')
  updateStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Ip() ip: string,
  ) {
    return this.adminService.updateStatus(
      admin.id,
      id,
      dto.status,
      dto.note,
      ip,
    );
  }

  @Post('orders/:id/notes')
  addNote(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddNoteDto,
    @Ip() ip: string,
  ) {
    return this.adminService.addNote(admin.id, id, dto.note, ip);
  }

  @Post('orders/:id/ship')
  ship(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Ip() ip: string,
  ) {
    return this.adminService.shipOrder(admin.id, id, ip);
  }

  /**
   * UPI (manual) payment verification — the admin has checked the UTR
   * against the business UPI/bank account. Marks the payment captured
   * and the order received. NOT done through PATCH status on purpose:
   * pending_payment has no admin transitions, so an unpaid order can
   * never be flipped to received by hand.
   */
  @Post('orders/:id/verify-upi-payment')
  verifyUpiPayment(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Ip() ip: string,
  ) {
    return this.adminService.verifyUpiPayment(admin.id, id, ip);
  }

  /** UPI payment rejected — the UTR could not be found in the business
   * account. Marks the payment failed and cancels the order. */
  @Post('orders/:id/reject-upi-payment')
  rejectUpiPayment(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Ip() ip: string,
  ) {
    return this.adminService.rejectUpiPayment(admin.id, id, ip);
  }

  // ---------------- Products ----------------

  @Get('products')
  async listProducts() {
    const products = await this.productsService.listAll();
    return products.map(serializeProduct);
  }

  @Post('products')
  async createProduct(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateProductDto,
    @Ip() ip: string,
  ) {
    const product = await this.productsService.create(dto);
    await this.audit.record({
      adminId: admin.id,
      action: 'product.create',
      entity: 'product',
      entityId: product.id,
      ipAddress: ip,
      details: { name: product.name, slug: product.slug },
    });
    return serializeProduct(product);
  }

  @Patch('products/:id')
  async updateProduct(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Ip() ip: string,
  ) {
    const product = await this.productsService.update(id, dto);
    await this.audit.record({
      adminId: admin.id,
      action: 'product.update',
      entity: 'product',
      entityId: product.id,
      ipAddress: ip,
      details: { name: product.name },
    });
    return serializeProduct(product);
  }

  @Delete('products/:id')
  async deleteProduct(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Ip() ip: string,
  ) {
    // Deactivate, never hard-delete (old orders reference the product).
    const product = await this.productsService.deactivate(id);
    await this.audit.record({
      adminId: admin.id,
      action: 'product.deactivate',
      entity: 'product',
      entityId: product.id,
      ipAddress: ip,
      details: { name: product.name },
    });
    return serializeProduct(product);
  }

  // ---------------- Customers ----------------

  @Get('customers')
  listCustomers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listCustomers(
      search,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('customers/:id')
  customerDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getCustomer(id);
  }

  // ---------------- Reports ----------------

  @Get('reports/sales')
  salesReport() {
    return this.adminService.salesReport();
  }

  // ---------------- Support ----------------

  @Get('support')
  listSupport(@Query('status') status?: string) {
    return this.adminService.listTickets(status);
  }

  @Post('support/:id/reply')
  replySupport(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyTicketDto,
    @Ip() ip: string,
  ) {
    return this.adminService.replyTicket(
      admin.id,
      id,
      dto.admin_reply,
      dto.status,
      ip,
    );
  }
}
