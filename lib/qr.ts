import QRCode from 'qrcode';

/**
 * Generate an inline data: URL for a QR code rendered with the platform's
 * teal/black brand palette by default. Used for agent storefronts and
 * any admin-managed QR assets.
 *
 * Keep this server-safe (no DOM). The `qrcode` package's `toDataURL` works
 * in Node when called without a canvas target.
 */
export async function generateQrDataUrl(
  url: string,
  fgColor: string = '#00C4BC',
  bgColor: string = '#0A1018'
): Promise<string> {
  return QRCode.toDataURL(url, {
    color: { dark: fgColor, light: bgColor },
    errorCorrectionLevel: 'M',
    width: 512,
  });
}
