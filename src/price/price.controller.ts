import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PriceService, PriceItem } from './price.service';
import { UpdatePriceDto } from './dto/update-price.dto';

@ApiTags('Price')
@ApiBearerAuth()
@Controller('price')
export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  @Get()
  async findAll(): Promise<PriceItem[]> {
    return this.priceService.getPrices();
  }

  @Put()
  async update(@Body() body: UpdatePriceDto): Promise<PriceItem> {
    return this.priceService.upsertPrice(body);
  }
}
