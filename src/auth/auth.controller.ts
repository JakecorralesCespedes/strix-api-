import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';
import { MailerService } from '../common/mailer.service';

class ForgotPasswordDto {
  @IsString()
  @IsEmail()
  email: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly mailerService: MailerService) {}

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    if (!body.email) {
      throw new BadRequestException('El correo es requerido');
    }

    try {
      await this.mailerService.sendPasswordReset({ email: body.email });
    } catch (error: any) {
      this.logger.warn(
        `No se pudo enviar el correo de recuperación a ${body.email}: ${error?.message ?? error}`,
      );
    }

    return {
      message:
        'Si la cuenta existe, recibirás un correo con instrucciones para restablecer tu contraseña.',
    };
  }
}
