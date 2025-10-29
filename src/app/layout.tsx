import './globals.css';
import Header from '@/components/Header';

export const metadata = {
  title: "Jose Melgarejo's blog",
  description: 'Cooking',
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
