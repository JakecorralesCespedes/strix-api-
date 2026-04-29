export const PDF_TEMPLATE_KEYS = [
  'pdfInstitutionName',
  'pdfHeaderTitle',
  'pdfHeaderSubtitle',
  'pdfFooterText',
  'pdfPrimaryColor',
  'pdfSignatureLabel',
  'pdfLogoDataUrl',
] as const;

export type PdfTemplateKey = (typeof PDF_TEMPLATE_KEYS)[number];

export type PdfTemplateConfig = Record<PdfTemplateKey, string>;

export const DEFAULT_PDF_TEMPLATE: PdfTemplateConfig = {
  pdfInstitutionName: 'Universidad',
  pdfHeaderTitle: 'Reporte de horas beca',
  pdfHeaderSubtitle: '',
  pdfFooterText:
    'Documento generado automaticamente por Strix al cerrar el periodo. Ante cualquier duda, contacta a tu jefe de departamento.',
  pdfPrimaryColor: '#1d4ed8',
  pdfSignatureLabel: 'Jefe de Departamento',
  pdfLogoDataUrl: '',
};
