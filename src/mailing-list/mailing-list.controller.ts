import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Query,
  Delete,
} from '@nestjs/common';
import { MailingListService } from './mailing-list.service';
import { GetMailingListDto } from './dto/get-mailing-list.dto';
import { CreateMailingListDto } from './dto/create-mailing-list.dto';
import { UpdateMailingListDto } from './dto/update-mailing-list.dto';
import { PaginatedResponse } from '../utils/pagination.util';
import { MailingList } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationParamsPipe } from '../pipes/pagination-params.pipe';
import { Roles } from '../guards/role.guard';
import { MAILING_LIST } from '../permissions/permissions';

@ApiTags('Mailing List')
@ApiBearerAuth()
@Controller('mailing-list')
export class MailingListController {
  constructor(private readonly mailingListService: MailingListService) {}

  @Post()
  @Roles(MAILING_LIST.MAILING_LIST_WRITE)
  create(@Body() createMailingListDto: CreateMailingListDto) {
    return this.mailingListService.createMailingList(createMailingListDto);
  }

  @Get()
  @Roles(MAILING_LIST.MAILING_LIST_READ)
  async findAll(
    @Query(new PaginationParamsPipe()) query: GetMailingListDto,
  ): Promise<PaginatedResponse<MailingList>> {
    return this.mailingListService.findAll(query);
  }

  @Get(':id')
  @Roles(MAILING_LIST.MAILING_LIST_READ)
  findOne(@Param('id') id: string) {
    return this.mailingListService.findOne(Number(id));
  }

  @Put(':id')
  @Roles(MAILING_LIST.MAILING_LIST_WRITE)
  update(
    @Param('id') id: string,
    @Body() updateMailingListDto: UpdateMailingListDto,
  ) {
    return this.mailingListService.updateMailingList(
      Number(id),
      updateMailingListDto,
    );
  }
  @Delete(':id')
  @Roles(MAILING_LIST.MAILING_LIST_DELETE)
  remove(@Param('id') id: string) {
    return this.mailingListService.remove(Number(id));
  }
}
