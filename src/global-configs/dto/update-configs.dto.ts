import { IsString } from 'class-validator';

export class UpdateConfigsDto {
  @IsString()
  defaultPrice: string;

  @IsString()
  tithCode: string;

  @IsString()
  studentsCode: string;

  @IsString()
  scolarshipCode: string;
}

export {
  PDF_TEMPLATE_KEYS,
  PdfTemplateKey,
  PdfTemplateConfig,
} from '../../common/pdf-template.config';
