import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DepartmentPricesService } from './department-prices.service';
import { CreateDepartmentPriceDto } from './dto/create-department-price.dto';
import { UpdateDepartmentPriceDto } from './dto/update-department-price.dto';
import { Roles } from '../guards/role.guard';
import { PRICING } from '../permissions/permissions';

@ApiTags('Department Prices')
@ApiBearerAuth()
@Controller('department-prices')
export class DepartmentPricesController {
  constructor(
    private readonly departmentPricesService: DepartmentPricesService,
  ) {}

  @Get()
  @Roles(PRICING.PRICING_READ)
  async findAll(
    @Query('departmentId') departmentId: string | undefined,
    @Req() req,
  ) {
    const numeric = departmentId ? Number(departmentId) : undefined;
    return this.departmentPricesService.findAll(req.user, numeric);
  }

  @Post()
  @Roles(PRICING.PRICING_WRITE)
  async create(@Body() body: CreateDepartmentPriceDto, @Req() req) {
    return this.departmentPricesService.create(body, req.user);
  }

  @Put(':id')
  @Roles(PRICING.PRICING_WRITE)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateDepartmentPriceDto,
    @Req() req,
  ) {
    return this.departmentPricesService.update(Number(id), body, req.user);
  }

  @Delete(':id')
  @Roles(PRICING.PRICING_WRITE)
  async remove(@Param('id') id: string, @Req() req) {
    return this.departmentPricesService.remove(Number(id), req.user);
  }
}
