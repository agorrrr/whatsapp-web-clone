import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ini Bukan Whatsapp',
  description: 'Ini Bukan Whatsapp - Chat, Foto, Voice Note, Stiker',
  icons: {
    icon: 'https://static.whatsapp.net/rsrc.php/v3/yP/r/rNqcCO-XYdm.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased bg-[#eae6df] dark:bg-[#0c1317]">
        {children}
      </body>
    </html>
  );
}
