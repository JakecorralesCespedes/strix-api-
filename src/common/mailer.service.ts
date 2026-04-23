import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter?: nodemailer.Transporter;
  private readonly fromAddress?: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const portValue = process.env.SMTP_PORT;
    const port = portValue ? Number(portValue) : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (!host || !port || !from) {
      this.logger.warn('SMTP not configured; email notifications disabled.');
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

  async sendMail(params: {
    to: string | string[];
    subject: string;
    text: string;
    html?: string;
    attachments?: MailAttachment[];
  }): Promise<void> {
    if (!this.transporter || !this.fromAddress) {
      this.logger.warn('Email skipped; SMTP not configured.');
      return;
    }

    const recipients = Array.isArray(params.to)
      ? params.to.filter(Boolean)
      : [params.to].filter(Boolean);

    if (!recipients.length) {
      this.logger.warn('Email skipped; no recipients.');
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
}
