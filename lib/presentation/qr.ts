import QRCode from "qrcode";

export async function generateAudienceQrDataUrl(url: string) {
  return QRCode.toDataURL(url, {
    width: 360,
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: "#0B1B2B",
      light: "#F5F1E8",
    },
  });
}
