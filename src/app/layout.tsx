import './globals.css';
import Header from '@/components/Header';

export const metadata = {
  title: 'Mi Sitio',
  description: 'Mi portafolio y blog',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="main-content mt-24">
          {children}
        </main>
      </body>
    </html>
  );
}

