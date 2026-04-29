import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PriceService, PriceItem } from './price.service';
import { UpdatePriceDto } from './dto/update-price.dto';
import { Roles } from '../guards/role.guard';
import { PRICING } from '../permissions/permissions';

@ApiTags('Price')
@ApiBearerAuth()
@Controller('price')
export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  @Get()
  @Roles(PRICING.PRICING_READ)
  async findAll(): Promise<PriceItem[]> {
    return this.priceService.getPrices();
  }

  @Put()
  @Roles(PRICING.PRICING_WRITE)
  async update(@Body() body: UpdatePriceDto): Promise<PriceItem> {
    return this.priceService.upsertPrice(body);
  }
}
