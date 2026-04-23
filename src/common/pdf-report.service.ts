import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

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

const CURRENCY = new Intl.NumberFormat('es-DO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_FORMATTER = new Intl.DateTimeFormat('es-DO', {
  dateStyle: 'medium',
});

@Injectable()
export class PdfReportService {
  async renderStudentPeriodReport(
    report: StudentPeriodReport,
  ): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc
      .fontSize(18)
      .fillColor('#1d4ed8')
      .text('Reporte de horas beca', { align: 'left' });
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
      `RD$ ${CURRENCY.format(report.hourlyRate)}`,
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
    doc.text('Pago (RD$)', col4X, tableTop, { width: 80, align: 'right' });

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
    doc.text(`RD$ ${CURRENCY.format(totalPay)}`, col4X, cursorY, {
      width: 80,
      align: 'right',
    });

    cursorY += 40;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#6b7280')
      .text(
        'Documento generado automaticamente por Strix al cerrar el periodo. Ante cualquier duda, contacta a tu jefe de departamento.',
        labelX,
        cursorY,
        { width: 500 },
      );

    doc.end();
    return finished;
  }
}
