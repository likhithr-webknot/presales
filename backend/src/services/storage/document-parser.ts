import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'

export async function parseDocument(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === 'application/pdf') {
    const data = await pdfParse(buffer)
    return data.text
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // XLSX and other formats — return empty string (structured parsing in Sprint 2+)
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return '[Spreadsheet content — structured parsing available in Sprint 2]'
  }

  // Plain text
  if (mimeType.startsWith('text/')) {
    return buffer.toString('utf-8')
  }

  return ''
}
