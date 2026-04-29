import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as admin from 'firebase-admin';
import { PrismaService } from './prisma.service';

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export const NOTIFICATION_KEYS = {
  USER_WELCOME: 'notify.user.welcome',
  USER_PASSWORD_RESET: 'notify.user.passwordReset',
  SCHOLARSHIP_APPROVED: 'notify.scholarship.approved',
  SCHOLARSHIP_REJECTED: 'notify.scholarship.rejected',
  WORK_HOURS_APPROVED: 'notify.workHours.approved',
} as const;

export type NotificationKey =
  (typeof NOTIFICATION_KEYS)[keyof typeof NOTIFICATION_KEYS];

const NOTIFICATION_DEFAULTS: Record<NotificationKey, boolean> = {
  [NOTIFICATION_KEYS.USER_WELCOME]: true,
  [NOTIFICATION_KEYS.USER_PASSWORD_RESET]: true,
  [NOTIFICATION_KEYS.SCHOLARSHIP_APPROVED]: true,
  [NOTIFICATION_KEYS.SCHOLARSHIP_REJECTED]: true,
  [NOTIFICATION_KEYS.WORK_HOURS_APPROVED]: true,
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter?: nodemailer.Transporter;
  private readonly fromAddress?: string;

  constructor(private readonly prismaService: PrismaService) {
    const host = process.env.SMTP_HOST;
    const portValue = process.env.SMTP_PORT;
    const port = portValue ? Number(portValue) : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (!host || !port || !from) {
      this.logger.warn('SMTP no configurado; las notificaciones quedarán deshabilitadas.');
      return;
    }

    this.fromAddress = from;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  isConfigured(): boolean {
    return !!this.transporter && !!this.fromAddress;
  }

  async getNotificationToggles(): Promise<Record<NotificationKey, boolean>> {
    const keys = Object.values(NOTIFICATION_KEYS) as NotificationKey[];
    const records = await this.prismaService.globalSetting.findMany({
      where: { key: { in: keys } },
    });

    const result: Record<NotificationKey, boolean> = { ...NOTIFICATION_DEFAULTS };
    for (const record of records) {
      if (keys.includes(record.key as NotificationKey)) {
        result[record.key as NotificationKey] = record.value === 'true';
      }
    }
    return result;
  }

  async isNotificationEnabled(key: NotificationKey): Promise<boolean> {
    const record = await this.prismaService.globalSetting.findUnique({
      where: { key },
    });
    if (!record) return NOTIFICATION_DEFAULTS[key] ?? true;
    return record.value === 'true';
  }

  async updateNotificationToggles(
    toggles: Partial<Record<NotificationKey, boolean>>,
  ): Promise<Record<NotificationKey, boolean>> {
    const validKeys = Object.values(NOTIFICATION_KEYS) as NotificationKey[];
    const entries = Object.entries(toggles).filter(([key]) =>
      validKeys.includes(key as NotificationKey),
    );

    await Promise.all(
      entries.map(([key, value]) =>
        this.prismaService.globalSetting.upsert({
          where: { key },
          update: { value: value ? 'true' : 'false' },
          create: { key, value: value ? 'true' : 'false' },
        }),
      ),
    );
    return this.getNotificationToggles();
  }

  async sendMail(params: {
    to: string | string[];
    subject: string;
    text: string;
    html?: string;
    attachments?: MailAttachment[];
  }): Promise<void> {
    if (!this.transporter || !this.fromAddress) {
      this.logger.warn('Correo omitido; SMTP no configurado.');
      return;
    }

    const recipients = Array.isArray(params.to)
      ? params.to.filter(Boolean)
      : [params.to].filter(Boolean);

    if (!recipients.length) {
      this.logger.warn('Correo omitido; sin destinatarios.');
      return;
    }

    await this.transporter.sendMail({
      from: this.fromAddress,
      to: recipients.join(','),
      subject: params.subject,
      text: params.text,
      html: params.html,
      attachments: params.attachments,
    });
  }

  async sendWelcomeUser(params: {
    name: string;
    email: string;
    password: string;
    roleName: string;
    departmentName: string;
    loginUrl?: string;
  }): Promise<void> {
    if (!(await this.isNotificationEnabled(NOTIFICATION_KEYS.USER_WELCOME))) {
      this.logger.log('Notificación de bienvenida deshabilitada.');
      return;
    }

    const loginUrl = params.loginUrl || process.env.APP_LOGIN_URL || '';
    const subject = 'Bienvenido al sistema Strix';

    const text = [
      `Hola ${params.name},`,
      '',
      'Tu cuenta de acceso al sistema Strix ya está creada. Estos son tus datos para iniciar sesión:',
      '',
      `Correo: ${params.email}`,
      `Contraseña: ${params.password}`,
      `Rol: ${params.roleName}`,
      `Departamento: ${params.departmentName}`,
      loginUrl ? `Acceso: ${loginUrl}` : '',
      '',
      'Te recomendamos cambiar tu contraseña la primera vez que ingreses.',
      '',
      'Sistema Strix - Gestión de Horas Beca',
    ]
      .filter(Boolean)
      .join('\n');

    const html = `
      <div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:auto;">
        <h2 style="color:#1d4ed8;margin-bottom:4px;">Bienvenido a Strix</h2>
        <p>Hola <strong>${escapeHtml(params.name)}</strong>,</p>
        <p>Tu cuenta de acceso al sistema Strix ya está creada. Estos son tus datos para iniciar sesión:</p>
        <table style="border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:6px 12px;color:#6b7280;">Correo:</td><td style="padding:6px 12px;font-weight:600;">${escapeHtml(params.email)}</td></tr>
          <tr><td style="padding:6px 12px;color:#6b7280;">Contraseña:</td><td style="padding:6px 12px;font-family:monospace;background:#f3f4f6;">${escapeHtml(params.password)}</td></tr>
          <tr><td style="padding:6px 12px;color:#6b7280;">Rol:</td><td style="padding:6px 12px;">${escapeHtml(params.roleName)}</td></tr>
          <tr><td style="padding:6px 12px;color:#6b7280;">Departamento:</td><td style="padding:6px 12px;">${escapeHtml(params.departmentName)}</td></tr>
        </table>
        ${loginUrl ? `<p><a href="${escapeHtml(loginUrl)}" style="background:#1d4ed8;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;display:inline-block;">Iniciar sesión</a></p>` : ''}
        <p style="color:#6b7280;font-size:13px;">Te recomendamos cambiar tu contraseña la primera vez que ingreses.</p>
        <p style="margin-top:20px;color:#6b7280;font-size:12px;">Sistema Strix - Gestión de Horas Beca</p>
      </div>`;

    await this.sendMail({
      to: params.email,
      subject,
      text,
      html,
    });
  }

  async sendPasswordReset(params: {
    name?: string;
    email: string;
  }): Promise<void> {
    if (
      !(await this.isNotificationEnabled(NOTIFICATION_KEYS.USER_PASSWORD_RESET))
    ) {
      this.logger.log('Notificación de recuperación de contraseña deshabilitada.');
      return;
    }

    const link = await admin.auth().generatePasswordResetLink(params.email);
    const subject = 'Recupera tu contraseña - Strix';
    const safeName = params.name ?? 'usuario';

    const text = [
      `Hola ${safeName},`,
      '',
      'Recibimos una solicitud para restablecer la contraseña de tu cuenta en Strix.',
      `Para crear una nueva contraseña ingresa al siguiente enlace:`,
      link,
      '',
      'Si no solicitaste este cambio, puedes ignorar este correo.',
      '',
      'Sistema Strix - Gestión de Horas Beca',
    ].join('\n');

    const html = `
      <div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:560px;margin:auto;">
        <h2 style="color:#1d4ed8;margin-bottom:4px;">Recupera tu contraseña</h2>
        <p>Hola <strong>${escapeHtml(safeName)}</strong>,</p>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Strix.</p>
        <p><a href="${escapeHtml(link)}" style="background:#1d4ed8;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;display:inline-block;">Restablecer contraseña</a></p>
        <p style="color:#6b7280;font-size:13px;">Si el botón no funciona, copia y pega este enlace:<br /><span style="word-break:break-all;">${escapeHtml(link)}</span></p>
        <p style="color:#6b7280;font-size:12px;margin-top:20px;">Si no solicitaste este cambio, puedes ignorar este correo.</p>
        <p style="margin-top:20px;color:#6b7280;font-size:12px;">Sistema Strix - Gestión de Horas Beca</p>
      </div>`;

    await this.sendMail({
      to: params.email,
      subject,
      text,
      html,
    });
  }
}
