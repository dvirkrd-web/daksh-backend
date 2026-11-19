import { Controller, Get, Param } from '@nestjs/common';
import { serializeProduct } from '../../common/serializers';
import { ProductsService } from './products.service';

/** Public catalogue: GET /products, GET /products/:slug. */
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async list() {
    const products = await this.productsService.listActive();
    return products.map(serializeProduct);
  }

  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    const product = await this.productsService.getBySlug(slug);
    return serializeProduct(product);
  }
}
