import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreatePeriodDto } from './dto/create-period.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';
import { Period, PeriodStatus, WorkHoursStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import {
  PaginatedResponse,
  createPaginatedResponse,
  createPaginationMetadata,
} from '../utils/pagination.util';
import { GetPeriodDto } from './dto/get-period.dto';
import { MailerService, NOTIFICATION_KEYS } from '../common/mailer.service';
import { PdfReportService } from '../common/pdf-report.service';

const DATE_FORMATTER = new Intl.DateTimeFormat('es-CR', {
  dateStyle: 'medium',
});

const CURRENCY = new Intl.NumberFormat('es-CR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

@Injectable()
export class PeriodsService {
  private readonly logger = new Logger(PeriodsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly mailerService: MailerService,
    private readonly pdfReportService: PdfReportService,
  ) {}

  async createPeriod(data: CreatePeriodDto): Promise<Period> {
    try {
      return this.prismaService.period.create({
        data: {
          name: data.name,
          start: new Date(data.start),
          end: new Date(data.end),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create period: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException('Could not be created');
    }
  }

  async findAll(query: GetPeriodDto): Promise<PaginatedResponse<Period>> {
    const { page = 1, size = 10, search } = query;
    const { take, skip } = createPaginationMetadata(page, size);
    const prismaQuery = {
      take,
      skip,
      where: search ? { name: { contains: search } } : {},
      include: {},
    };
    const [periods, total] = await Promise.all([
      this.prismaService.period.findMany(prismaQuery),
      this.prismaService.period.count({
        where: search ? { name: { contains: search } } : {},
      }),
    ]);
    return createPaginatedResponse<Period>(periods, total, page, size);
  }

  findOne(id: number) {
    return this.prismaService.period.findFirst({
      where: {
        id,
      },
    });
  }

  async updatePeriod(id: number, data: UpdatePeriodDto): Promise<Period> {
    const existing = await this.prismaService.period.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new BadRequestException('Period not found');
    }
    const updateData: {
      name?: string;
      start?: Date;
      end?: Date;
      status?: PeriodStatus;
    } = {
      name: data.name,
      start: data.start ? new Date(data.start) : undefined,
      end: data.end ? new Date(data.end) : undefined,
    };
    if (data.status) {
      updateData.status = data.status as PeriodStatus;
    }
    return this.prismaService.period.update({
      where: { id },
      data: updateData,
    });
  }

  async reopenPeriod(
    id: number,
    nextStatus: PeriodStatus = PeriodStatus.ACTIVE,
  ): Promise<Period> {
    const period = await this.prismaService.period.findUnique({
      where: { id },
    });
    if (!period) {
      throw new BadRequestException('Period not found');
    }
    if (period.status !== PeriodStatus.CLOSED) {
      throw new BadRequestException('Solo se pueden reabrir periodos cerrados');
    }
    if (
      nextStatus !== PeriodStatus.ACTIVE &&
      nextStatus !== PeriodStatus.FINISHED &&
      nextStatus !== PeriodStatus.PENDING
    ) {
      throw new BadRequestException(
        'Estado destino inválido al reabrir el periodo',
      );
    }
    return this.prismaService.period.update({
      where: { id },
      data: { status: nextStatus },
    });
  }

  async closePeriod(id: number): Promise<{
    period: Period;
    emailsSent: number;
    emailsSkipped: number;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
    smtpConfigured: boolean;
    notificationsEnabled: boolean;
    reason?: string;
  }> {
    const period = await this.prismaService.period.findUnique({
      where: { id },
    });

    if (!period) {
      throw new BadRequestException('Period not found');
    }

    if (period.status === PeriodStatus.CLOSED) {
      throw new BadRequestException('El periodo ya está cerrado');
    }

    const closed = await this.prismaService.period.update({
      where: { id },
      data: { status: PeriodStatus.CLOSED },
    });

    const summary = {
      emailsSent: 0,
      emailsSkipped: 0,
      approvedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      smtpConfigured: this.mailerService.isConfigured(),
      notificationsEnabled: true as boolean,
      reason: undefined as string | undefined,
    };

    try {
      const [approvedHours, pendingCount, rejectedCount] = await Promise.all([
        this.prismaService.workHours.findMany({
          where: { periodId: id, status: WorkHoursStatus.APPROVED },
          include: { student: true, department: true },
          orderBy: { start: 'asc' },
        }),
        this.prismaService.workHours.count({
          where: { periodId: id, status: WorkHoursStatus.PENDING },
        }),
        this.prismaService.workHours.count({
          where: { periodId: id, status: WorkHoursStatus.REJECTED },
        }),
      ]);

      summary.approvedCount = approvedHours.length;
      summary.pendingCount = pendingCount;
      summary.rejectedCount = rejectedCount;

      summary.notificationsEnabled =
        await this.mailerService.isNotificationEnabled(
          NOTIFICATION_KEYS.WORK_HOURS_APPROVED,
        );

      if (!summary.smtpConfigured) {
        summary.reason = 'El servicio SMTP no está configurado.';
      } else if (!summary.notificationsEnabled) {
        summary.reason =
          'Las notificaciones de horas aprobadas están desactivadas.';
      } else if (!approvedHours.length) {
        summary.reason =
          'No hay horas aprobadas en este periodo para enviar reportes.';
      }

      if (summary.reason) {
        return { period: closed, ...summary };
      }

      const byStudentAndDepartment = new Map<
        string,
        {
          studentId: number;
          departmentId: number;
          studentName: string;
          studentCode: string;
          studentEmail: string;
          departmentName: string;
          hourlyRate: number;
          rows: { date: Date; description: string; hours: number }[];
        }
      >();

      for (const entry of approvedHours) {
        const key = `${entry.studentId}-${entry.departmentId}`;
        if (!byStudentAndDepartment.has(key)) {
          byStudentAndDepartment.set(key, {
            studentId: entry.studentId,
            departmentId: entry.departmentId,
            studentName: entry.student?.name ?? 'Estudiante',
            studentCode: entry.student?.code ?? '-',
            studentEmail: entry.student?.email ?? '',
            departmentName: entry.department?.name ?? '-',
            hourlyRate: entry.price,
            rows: [],
          });
        }

        const bucket = byStudentAndDepartment.get(key)!;
        bucket.rows.push({
          date: entry.start,
          description: entry.name ?? 'Horas beca',
          hours: entry.amount,
        });
      }

      for (const bucket of byStudentAndDepartment.values()) {
        if (!bucket.studentEmail) {
          summary.emailsSkipped += 1;
          continue;
        }

        const totalHours = bucket.rows.reduce((acc, row) => acc + row.hours, 0);
        const totalPay = totalHours * bucket.hourlyRate;

        try {
          const pdf = await this.pdfReportService.renderStudentPeriodReport({
            studentName: bucket.studentName,
            studentCode: bucket.studentCode,
            departmentName: bucket.departmentName,
            periodName: closed.name,
            periodStart: closed.start,
            periodEnd: closed.end,
            hourlyRate: bucket.hourlyRate,
            rows: bucket.rows,
          });

          const subject = `Reporte de horas beca - ${closed.name}`;
          const text = [
            `Hola ${bucket.studentName},`,
            '',
            `El periodo "${closed.name}" (${DATE_FORMATTER.format(
              closed.start,
            )} al ${DATE_FORMATTER.format(closed.end)}) fue cerrado.`,
            '',
            `Resumen:`,
            `- Departamento: ${bucket.departmentName}`,
            `- Horas aprobadas: ${totalHours.toFixed(2)}`,
            `- Precio por hora: ₡${CURRENCY.format(bucket.hourlyRate)}`,
            `- Total: ₡${CURRENCY.format(totalPay)}`,
            '',
            'Adjunto encontraras el detalle dia por dia en PDF.',
            '',
            'Sistema Strix - Gestion de Horas Beca',
          ].join('\n');

          const html = buildClosedPeriodEmailHtml({
            studentName: bucket.studentName,
            departmentName: bucket.departmentName,
            periodName: closed.name,
            periodStart: closed.start,
            periodEnd: closed.end,
            totalHours,
            hourlyRate: bucket.hourlyRate,
            totalPay,
            rows: bucket.rows,
          });

          await this.mailerService.sendMail({
            to: bucket.studentEmail,
            subject,
            text,
            html,
            attachments: [
              {
                filename: `reporte-${closed.name.replace(/\s+/g, '_')}-${bucket.studentCode}.pdf`,
                content: pdf,
                contentType: 'application/pdf',
              },
            ],
          });

          summary.emailsSent += 1;
        } catch (err) {
          this.logger.warn(
            `Failed to send closed-period email for student ${bucket.studentCode}: ${(err as Error).message}`,
          );
          summary.emailsSkipped += 1;
        }
      }
    } catch (err) {
      this.logger.warn(
        `Period ${id} closed but email generation failed: ${(err as Error).message}`,
      );
    }

    return { period: closed, ...summary };
  }
}

function buildClosedPeriodEmailHtml(params: {
  studentName: string;
  departmentName: string;
  periodName: string;
  periodStart: Date;
  periodEnd: Date;
  totalHours: number;
  hourlyRate: number;
  totalPay: number;
  rows: { date: Date; description: string; hours: number }[];
}): string {
  const rowsHtml = params.rows
    .map(
      (row) =>
        `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${DATE_FORMATTER.format(row.date)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(row.description)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${row.hours.toFixed(2)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">₡${CURRENCY.format(row.hours * params.hourlyRate)}</td>
        </tr>`,
    )
    .join('');

  return `
  <div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:640px;margin:auto;">
    <h2 style="color:#1d4ed8;margin-bottom:4px;">Cierre de periodo</h2>
    <p style="margin:0 0 16px 0;color:#4b5563;">${params.periodName} (${DATE_FORMATTER.format(params.periodStart)} al ${DATE_FORMATTER.format(params.periodEnd)})</p>
    <p>Hola <strong>${escapeHtml(params.studentName)}</strong>,</p>
    <p>Tu reporte de horas beca para el departamento <strong>${escapeHtml(params.departmentName)}</strong> esta listo. Encontraras la version formal en PDF adjunta a este correo.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="text-align:left;padding:6px 8px;">Fecha</th>
          <th style="text-align:left;padding:6px 8px;">Descripcion</th>
          <th style="text-align:right;padding:6px 8px;">Horas</th>
          <th style="text-align:right;padding:6px 8px;">Pago</th>
        </tr>
      </thead>
      <tbody>${rowsHtml || '<tr><td colspan="4" style="padding:6px 8px;color:#6b7280;">Sin horas aprobadas.</td></tr>'}</tbody>
    </table>
    <table style="width:100%;margin-top:12px;font-size:14px;">
      <tr>
        <td style="padding:4px 8px;color:#4b5563;">Total horas</td>
        <td style="padding:4px 8px;text-align:right;font-weight:600;">${params.totalHours.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:4px 8px;color:#4b5563;">Precio por hora</td>
        <td style="padding:4px 8px;text-align:right;">₡${CURRENCY.format(params.hourlyRate)}</td>
      </tr>
      <tr>
        <td style="padding:4px 8px;color:#111827;font-weight:600;">Total a recibir</td>
        <td style="padding:4px 8px;text-align:right;font-weight:700;color:#047857;">₡${CURRENCY.format(params.totalPay)}</td>
      </tr>
    </table>
    <p style="margin-top:20px;color:#6b7280;font-size:12px;">Sistema Strix - Gestion de Horas Beca</p>
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
