import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import { PrismaService } from './prisma.service';
import {
  DEFAULT_PDF_TEMPLATE,
  PDF_TEMPLATE_KEYS,
  PdfTemplateConfig,
} from './pdf-template.config';

export type WorkHoursRow = {
  date: Date;
  description: string;
  hours: number;
};

export type StudentPeriodReport = {
  studentName: string;
  studentCode: string;
  departmentName: string;
  periodName: string;
  periodStart: Date;
  periodEnd: Date;
  hourlyRate: number;
  rows: WorkHoursRow[];
};

const CURRENCY = new Intl.NumberFormat('es-CR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_FORMATTER = new Intl.DateTimeFormat('es-CR', {
  dateStyle: 'medium',
});

@Injectable()
export class PdfReportService {
  private readonly logger = new Logger(PdfReportService.name);

  constructor(private readonly prismaService: PrismaService) {}

  private async loadTemplate(): Promise<PdfTemplateConfig> {
    try {
      const settings = await this.prismaService.globalSetting.findMany({
        where: { key: { in: [...PDF_TEMPLATE_KEYS] } },
      });
      const map = settings.reduce<Record<string, string>>((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {});
      const result = { ...DEFAULT_PDF_TEMPLATE };
      for (const key of PDF_TEMPLATE_KEYS) {
        const stored = map[key];
        if (typeof stored === 'string' && stored.trim().length > 0) {
          result[key] = stored;
        }
      }

      if (!/^#[0-9a-fA-F]{6}$/.test(result.pdfPrimaryColor)) {
        result.pdfPrimaryColor = DEFAULT_PDF_TEMPLATE.pdfPrimaryColor;
      }
      return result;
    } catch (err) {
      this.logger.warn(
        `Failed to load PDF template config, using defaults: ${(err as Error).message}`,
      );
      return { ...DEFAULT_PDF_TEMPLATE };
    }
  }

  private decodeLogo(dataUrl: string): Buffer | null {
    const match = dataUrl.match(
      /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/,
    );
    if (!match) return null;
    try {
      return Buffer.from(match[2], 'base64');
    } catch {
      return null;
    }
  }

  async renderStudentPeriodReport(
    report: StudentPeriodReport,
  ): Promise<Buffer> {
    const template = await this.loadTemplate();
    const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const headerStartY = doc.y;
    const logoBuffer = template.pdfLogoDataUrl
      ? this.decodeLogo(template.pdfLogoDataUrl)
      : null;

    if (logoBuffer) {
      const logoSize = 60;
      const logoX = doc.page.width - doc.page.margins.right - logoSize;
      try {
        doc.image(logoBuffer, logoX, headerStartY, {
          fit: [logoSize, logoSize],
          align: 'right',
        });
      } catch (err) {
        this.logger.warn(
          `Failed to render PDF logo: ${(err as Error).message}`,
        );
      }
      doc.y = headerStartY;
    }

    if (template.pdfInstitutionName) {
      doc
        .fontSize(11)
        .fillColor('#6b7280')
        .text(template.pdfInstitutionName, { align: 'left' });
    }

    doc
      .fontSize(18)
      .fillColor(template.pdfPrimaryColor)
      .text(template.pdfHeaderTitle || 'Reporte de horas beca', {
        align: 'left',
      });

    if (template.pdfHeaderSubtitle) {
      doc
        .fontSize(11)
        .fillColor('#4b5563')
        .text(template.pdfHeaderSubtitle, { align: 'left' });
    }

    doc
      .fontSize(10)
      .fillColor('#4b5563')
      .text(`Generado: ${DATE_FORMATTER.format(new Date())}`);
    doc.moveDown(0.8);

    const labelX = doc.page.margins.left;
    doc.fontSize(11).fillColor('#111827');

    const drawPair = (label: string, value: string) => {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(value);
    };

    drawPair('Estudiante', `${report.studentName} (${report.studentCode})`);
    drawPair('Departamento', report.departmentName);
    drawPair(
      'Periodo',
      `${report.periodName} - ${DATE_FORMATTER.format(report.periodStart)} al ${DATE_FORMATTER.format(report.periodEnd)}`,
    );
    drawPair(
      'Precio por hora',
      `₡${CURRENCY.format(report.hourlyRate)}`,
    );
    doc.moveDown(1);

    const tableTop = doc.y;
    const col1X = labelX;
    const col2X = labelX + 110;
    const col3X = labelX + 330;
    const col4X = labelX + 420;

    doc.font('Helvetica-Bold').fillColor('#111827');
    doc.text('Fecha', col1X, tableTop);
    doc.text('Descripcion', col2X, tableTop);
    doc.text('Horas', col3X, tableTop, { width: 60, align: 'right' });
    doc.text('Pago (₡)', col4X, tableTop, { width: 80, align: 'right' });

    doc
      .moveTo(col1X, tableTop + 16)
      .lineTo(labelX + 500, tableTop + 16)
      .strokeColor('#d1d5db')
      .stroke();

    let cursorY = tableTop + 20;
    let totalHours = 0;
    let totalPay = 0;

    doc.font('Helvetica').fontSize(10);
    for (const row of report.rows) {
      const rowPay = row.hours * report.hourlyRate;
      totalHours += row.hours;
      totalPay += rowPay;

      if (cursorY > doc.page.height - doc.page.margins.bottom - 60) {
        doc.addPage();
        cursorY = doc.page.margins.top;
      }

      doc.text(DATE_FORMATTER.format(row.date), col1X, cursorY, { width: 100 });
      doc.text(row.description, col2X, cursorY, { width: 210 });
      doc.text(row.hours.toFixed(2), col3X, cursorY, {
        width: 60,
        align: 'right',
      });
      doc.text(CURRENCY.format(rowPay), col4X, cursorY, {
        width: 80,
        align: 'right',
      });

      cursorY += 18;
    }

    if (!report.rows.length) {
      doc
        .font('Helvetica-Oblique')
        .fillColor('#6b7280')
        .text('No hay horas aprobadas en este periodo.', col1X, cursorY);
      cursorY += 18;
    }

    cursorY += 12;
    doc
      .moveTo(col1X, cursorY)
      .lineTo(labelX + 500, cursorY)
      .strokeColor('#9ca3af')
      .stroke();
    cursorY += 8;

    const tithe = totalPay * 0.1;
    const net = totalPay - tithe;

    doc.font('Helvetica-Bold').fillColor('#111827').fontSize(11);
    doc.text('Total horas', col1X, cursorY);
    doc.text(totalHours.toFixed(2), col3X, cursorY, { width: 60, align: 'right' });
    doc.text(`₡${CURRENCY.format(totalPay)}`, col4X, cursorY, { width: 80, align: 'right' });
    cursorY += 16;

    doc.font('Helvetica').fillColor('#6b7280').fontSize(10);
    doc.text('Diezmo (10%)', col1X, cursorY);
    doc.text(`- ₡${CURRENCY.format(tithe)}`, col4X, cursorY, { width: 80, align: 'right' });
    cursorY += 16;

    doc.font('Helvetica-Bold').fillColor(template.pdfPrimaryColor).fontSize(12);
    doc.text('Neto a pagar', col1X, cursorY);
    doc.text(`₡${CURRENCY.format(net)}`, col4X, cursorY, { width: 80, align: 'right' });

    cursorY += 40;

    if (template.pdfSignatureLabel) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#111827')
        .text('___________________________', labelX, cursorY);
      cursorY += 14;
      doc
        .fontSize(10)
        .fillColor('#374151')
        .text(template.pdfSignatureLabel, labelX, cursorY);
      cursorY += 24;
    }

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#6b7280')
      .text(
        template.pdfFooterText ||
          'Documento generado automaticamente por Strix al cerrar el periodo.',
        labelX,
        cursorY,
        { width: 500 },
      );

    doc.end();
    return finished;
  }

  private renderTemplateHeader(doc: PDFKit.PDFDocument, template: PdfTemplateConfig, title: string) {
    const headerStartY = doc.y;
    const logoBuffer = template.pdfLogoDataUrl
      ? this.decodeLogo(template.pdfLogoDataUrl)
      : null;

    if (logoBuffer) {
      const logoSize = 60;
      const logoX = doc.page.width - doc.page.margins.right - logoSize;
      try {
        doc.image(logoBuffer, logoX, headerStartY, {
          fit: [logoSize, logoSize],
          align: 'right',
        });
      } catch (err) {
        this.logger.warn(
          `Failed to render PDF logo: ${(err as Error).message}`,
        );
      }
      doc.y = headerStartY;
    }

    if (template.pdfInstitutionName) {
      doc
        .fontSize(11)
        .fillColor('#6b7280')
        .text(template.pdfInstitutionName, { align: 'left' });
    }

    doc
      .fontSize(18)
      .fillColor(template.pdfPrimaryColor)
      .text(title, { align: 'left' });

    if (template.pdfHeaderSubtitle) {
      doc
        .fontSize(11)
        .fillColor('#4b5563')
        .text(template.pdfHeaderSubtitle, { align: 'left' });
    }
  }

  private renderTemplateFooter(
    doc: PDFKit.PDFDocument,
    template: PdfTemplateConfig,
    cursorY: number,
  ): number {
    const labelX = doc.page.margins.left;
    let y = cursorY;
    if (template.pdfSignatureLabel) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#111827')
        .text('___________________________', labelX, y);
      y += 14;
      doc.fontSize(10).fillColor('#374151').text(
        template.pdfSignatureLabel,
        labelX,
        y,
      );
      y += 24;
    }

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#6b7280')
      .text(
        template.pdfFooterText ||
          'Documento generado automaticamente por Strix.',
        labelX,
        y,
        { width: 500 },
      );
    return y;
  }

  async renderWorkHoursReport(params: {
    periodId?: number;
    departmentId?: number;
    studentId?: number;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    startDate?: string;
    endDate?: string;
    title?: string;
  }): Promise<Buffer> {
    const where: any = {};
    if (params.periodId) where.periodId = params.periodId;
    if (params.departmentId) where.departmentId = params.departmentId;
    if (params.studentId) where.studentId = params.studentId;
    if (params.status) where.status = params.status;
    if (params.startDate || params.endDate) {
      where.start = {};
      if (params.startDate) where.start.gte = new Date(params.startDate);
      if (params.endDate) {
        const end = new Date(params.endDate);
        end.setHours(23, 59, 59, 999);
        where.start.lte = end;
      }
    }

    const rows = await this.prismaService.workHours.findMany({
      where,
      include: { student: true, department: true, period: true },
      orderBy: [{ start: 'asc' }],
    });

    const template = await this.loadTemplate();
    const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const labelX = doc.page.margins.left;
    this.renderTemplateHeader(
      doc,
      template,
      params.title || 'Reporte de horas beca',
    );

    doc
      .fontSize(10)
      .fillColor('#4b5563')
      .text(`Generado: ${DATE_FORMATTER.format(new Date())}`);
    doc.text(`Total de registros: ${rows.length}`);
    doc.moveDown(0.6);

    const col1X = labelX;
    const col2X = labelX + 70;
    const col3X = labelX + 200;
    const col4X = labelX + 320;
    const col5X = labelX + 380;
    const col6X = labelX + 425;
    const col7X = labelX + 475;
    const tableEndX = labelX + 520;

    let cursorY = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
    doc.text('Fecha', col1X, cursorY, { width: 65 });
    doc.text('Estudiante', col2X, cursorY, { width: 125 });
    doc.text('Departamento', col3X, cursorY, { width: 115 });
    doc.text('Estado', col4X, cursorY, { width: 55 });
    doc.text('Horas', col5X, cursorY, { width: 40, align: 'right' });
    doc.text('Precio', col6X, cursorY, { width: 45, align: 'right' });
    doc.text('Total', col7X, cursorY, { width: 50, align: 'right' });
    cursorY += 12;
    doc
      .moveTo(col1X, cursorY)
      .lineTo(tableEndX, cursorY)
      .strokeColor('#d1d5db')
      .stroke();
    cursorY += 4;

    let totalHours = 0;
    let totalApprovedPay = 0;

    doc.font('Helvetica').fontSize(9).fillColor('#111827');
    for (const row of rows) {
      if (cursorY > doc.page.height - doc.page.margins.bottom - 60) {
        doc.addPage();
        cursorY = doc.page.margins.top;
      }
      const total = row.amount * row.price;
      const statusLabel =
        row.status === 'APPROVED'
          ? 'Aprobada'
          : row.status === 'REJECTED'
            ? 'Rechazada'
            : 'Pendiente';
      if (row.status === 'APPROVED') {
        totalHours += row.amount;
        totalApprovedPay += total;
      }
      doc.text(DATE_FORMATTER.format(row.start), col1X, cursorY, { width: 65 });
      doc.text(row.student?.name ?? '-', col2X, cursorY, { width: 125 });
      doc.text(row.department?.name ?? '-', col3X, cursorY, { width: 115 });
      doc.text(statusLabel, col4X, cursorY, { width: 55 });
      doc.text(row.amount.toFixed(2), col5X, cursorY, {
        width: 40,
        align: 'right',
      });
      doc.text(CURRENCY.format(row.price), col6X, cursorY, {
        width: 45,
        align: 'right',
      });
      doc.text(CURRENCY.format(total), col7X, cursorY, {
        width: 50,
        align: 'right',
      });
      cursorY += 14;
    }

    if (!rows.length) {
      doc
        .font('Helvetica-Oblique')
        .fillColor('#6b7280')
        .text('No hay registros para los filtros aplicados.', col1X, cursorY);
      cursorY += 18;
    } else {
      cursorY += 4;
      doc
        .moveTo(col1X, cursorY)
        .lineTo(tableEndX, cursorY)
        .strokeColor(template.pdfPrimaryColor)
        .lineWidth(1.5)
        .stroke();
      doc.lineWidth(1);
      cursorY += 6;
      const wTithe = totalApprovedPay * 0.1;
      const wNet = totalApprovedPay - wTithe;

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827')
        .text('Total horas aprobadas', col1X, cursorY);
      doc.text(totalHours.toFixed(2), col5X, cursorY, { width: 40, align: 'right' });
      doc.text(`₡${CURRENCY.format(totalApprovedPay)}`, col7X, cursorY, { width: 50, align: 'right' });
      cursorY += 14;

      doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
        .text('Diezmo (10%)', col1X, cursorY);
      doc.text(`- ₡${CURRENCY.format(wTithe)}`, col7X, cursorY, { width: 50, align: 'right' });
      cursorY += 14;

      doc.font('Helvetica-Bold').fontSize(11).fillColor(template.pdfPrimaryColor)
        .text('Neto a pagar', col1X, cursorY);
      doc.text(`₡${CURRENCY.format(wNet)}`, col7X, cursorY, { width: 50, align: 'right' });
      cursorY += 24;
    }

    this.renderTemplateFooter(doc, template, cursorY);

    doc.end();
    return finished;
  }

  async renderPeriodConsolidatedReport(periodId: number): Promise<Buffer> {
    const period = await this.prismaService.period.findUnique({
      where: { id: periodId },
    });
    if (!period) {
      throw new Error('Period not found');
    }

    const workHours = await this.prismaService.workHours.findMany({
      where: { periodId },
      include: { student: true, department: true },
      orderBy: [{ studentId: 'asc' }, { start: 'asc' }],
    });

    type Bucket = {
      studentName: string;
      studentCode: string;
      departmentName: string;
      rows: {
        date: Date;
        description: string;
        hours: number;
        rate: number;
        status: string;
      }[];
    };
    const buckets = new Map<string, Bucket>();

    for (const entry of workHours) {
      const key = `${entry.studentId}-${entry.departmentId}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          studentName: entry.student?.name ?? 'Estudiante',
          studentCode: entry.student?.code ?? '-',
          departmentName: entry.department?.name ?? '-',
          rows: [],
        });
      }
      buckets.get(key)!.rows.push({
        date: entry.start,
        description: entry.name ?? 'Horas beca',
        hours: entry.amount,
        rate: entry.price,
        status: entry.status,
      });
    }

    const template = await this.loadTemplate();
    const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const labelX = doc.page.margins.left;
    this.renderTemplateHeader(
      doc,
      template,
      `${template.pdfHeaderTitle || 'Reporte consolidado de periodo'} - ${period.name}`,
    );

    doc
      .fontSize(10)
      .fillColor('#4b5563')
      .text(
        `Periodo: ${DATE_FORMATTER.format(period.start)} al ${DATE_FORMATTER.format(period.end)}`,
      );
    doc.text(`Generado: ${DATE_FORMATTER.format(new Date())}`);
    doc.moveDown(0.6);

    const col1X = labelX;
    const col2X = labelX + 90;
    const col3X = labelX + 270;
    const col4X = labelX + 330;
    const col5X = labelX + 390;
    const col6X = labelX + 450;
    const tableEndX = labelX + 510;

    let cursorY = doc.y;
    let grandHours = 0;
    let grandPay = 0;

    if (!buckets.size) {
      doc
        .font('Helvetica-Oblique')
        .fillColor('#6b7280')
        .text('No hay horas registradas en este periodo.', labelX, cursorY);
    }

    for (const [, bucket] of buckets) {
      if (cursorY > doc.page.height - doc.page.margins.bottom - 120) {
        doc.addPage();
        cursorY = doc.page.margins.top;
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#111827')
        .text(`${bucket.studentName} (${bucket.studentCode})`, labelX, cursorY);
      cursorY += 16;
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#4b5563')
        .text(`Departamento: ${bucket.departmentName}`, labelX, cursorY);
      cursorY += 14;

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
      doc.text('Fecha', col1X, cursorY, { width: 80 });
      doc.text('Descripción', col2X, cursorY, { width: 170 });
      doc.text('Estado', col3X, cursorY, { width: 55 });
      doc.text('Horas', col4X, cursorY, { width: 55, align: 'right' });
      doc.text('Precio (₡)', col5X, cursorY, { width: 55, align: 'right' });
      doc.text('Subtotal (₡)', col6X, cursorY, { width: 60, align: 'right' });
      cursorY += 12;
      doc
        .moveTo(col1X, cursorY)
        .lineTo(tableEndX, cursorY)
        .strokeColor('#d1d5db')
        .stroke();
      cursorY += 4;

      let subHours = 0;
      let subPay = 0;

      doc.font('Helvetica').fontSize(9).fillColor('#111827');
      for (const row of bucket.rows) {
        if (cursorY > doc.page.height - doc.page.margins.bottom - 60) {
          doc.addPage();
          cursorY = doc.page.margins.top;
        }
        const subtotal = row.status === 'APPROVED' ? row.hours * row.rate : 0;
        if (row.status === 'APPROVED') {
          subHours += row.hours;
          subPay += subtotal;
        }
        const statusLabel =
          row.status === 'APPROVED'
            ? 'Aprobada'
            : row.status === 'REJECTED'
              ? 'Rechazada'
              : 'Pendiente';
        doc.text(DATE_FORMATTER.format(row.date), col1X, cursorY, {
          width: 80,
        });
        doc.text(row.description, col2X, cursorY, { width: 170 });
        doc.text(statusLabel, col3X, cursorY, { width: 55 });
        doc.text(row.hours.toFixed(2), col4X, cursorY, {
          width: 55,
          align: 'right',
        });
        doc.text(CURRENCY.format(row.rate), col5X, cursorY, {
          width: 55,
          align: 'right',
        });
        doc.text(
          row.status === 'APPROVED' ? CURRENCY.format(subtotal) : '-',
          col6X,
          cursorY,
          { width: 60, align: 'right' },
        );
        cursorY += 14;
      }

      cursorY += 4;
      doc
        .moveTo(col1X, cursorY)
        .lineTo(tableEndX, cursorY)
        .strokeColor('#9ca3af')
        .stroke();
      cursorY += 6;

      const subTithe = subPay * 0.1;
      const subNet = subPay - subTithe;

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827')
        .text('Total horas aprobadas', col1X, cursorY);
      doc.text(subHours.toFixed(2), col4X, cursorY, { width: 55, align: 'right' });
      doc.text(`₡${CURRENCY.format(subPay)}`, col6X, cursorY, { width: 60, align: 'right' });
      cursorY += 14;

      doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
        .text('Diezmo (10%)', col1X, cursorY);
      doc.text(`- ₡${CURRENCY.format(subTithe)}`, col6X, cursorY, { width: 60, align: 'right' });
      cursorY += 14;

      doc.font('Helvetica-Bold').fontSize(10).fillColor(template.pdfPrimaryColor)
        .text('Neto a pagar', col1X, cursorY);
      doc.text(`₡${CURRENCY.format(subNet)}`, col6X, cursorY, { width: 60, align: 'right' });
      cursorY += 28;

      grandHours += subHours;
      grandPay += subPay;
    }

    if (cursorY > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();
      cursorY = doc.page.margins.top;
    }

    doc
      .moveTo(col1X, cursorY)
      .lineTo(tableEndX, cursorY)
      .strokeColor(template.pdfPrimaryColor)
      .lineWidth(1.5)
      .stroke();
    doc.lineWidth(1);
    cursorY += 8;

    const grandTithe = grandPay * 0.1;
    const grandNet = grandPay - grandTithe;

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827')
      .text('Total general aprobado', col1X, cursorY);
    doc.text(grandHours.toFixed(2), col4X, cursorY, { width: 55, align: 'right' });
    doc.text(`₡${CURRENCY.format(grandPay)}`, col6X, cursorY, { width: 60, align: 'right' });
    cursorY += 16;

    doc.font('Helvetica').fontSize(10).fillColor('#6b7280')
      .text('Diezmo total (10%)', col1X, cursorY);
    doc.text(`- ₡${CURRENCY.format(grandTithe)}`, col6X, cursorY, { width: 60, align: 'right' });
    cursorY += 16;

    doc.font('Helvetica-Bold').fontSize(13).fillColor(template.pdfPrimaryColor)
      .text('Neto total a pagar', col1X, cursorY);
    doc.text(`₡${CURRENCY.format(grandNet)}`, col6X, cursorY, { width: 60, align: 'right' });
    cursorY += 36;

    this.renderTemplateFooter(doc, template, cursorY);

    doc.end();
    return finished;
  }
}
