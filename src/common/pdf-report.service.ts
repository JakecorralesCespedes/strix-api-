import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
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

    doc.font('Helvetica-Bold').fillColor('#111827').fontSize(11);
    doc.text('Total horas', col1X, cursorY);
    doc.text(totalHours.toFixed(2), col3X, cursorY, {
      width: 60,
      align: 'right',
    });
    doc.text(`₡${CURRENCY.format(totalPay)}`, col4X, cursorY, {
      width: 80,
      align: 'right',
    });

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
}
