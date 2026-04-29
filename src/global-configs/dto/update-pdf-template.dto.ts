import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsHexColor,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdatePdfTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  pdfInstitutionName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  pdfHeaderTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  pdfHeaderSubtitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pdfFooterText?: string;

  @ApiPropertyOptional({ description: 'Hex color, e.g. #1d4ed8' })
  @IsOptional()
  @IsHexColor()
  pdfPrimaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  pdfSignatureLabel?: string;

  @ApiPropertyOptional({
    description:
      'Logo as data URL (data:image/png;base64,... or data:image/jpeg;base64,...). Empty string clears the logo.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  @Matches(/^$|^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/, {
    message: 'pdfLogoDataUrl must be a PNG or JPEG data URL, or empty.',
  })
  pdfLogoDataUrl?: string;
}
