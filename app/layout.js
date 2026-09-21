import "./globals.css";

export const metadata = {
  title: "Açılım Kutu PPWR",
  description: "Açılım Kutu PPWR ambalaj uygunluk ve belge portalı",
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }) {
  return <html lang="tr"><body>{children}</body></html>;
}
