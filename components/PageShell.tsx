import Navbar from './Navbar';
import FooterSection from './FooterSection';

/**
 * Standard public-page frame: fixed Navbar, top-padded main content,
 * and the shared Footer. Used by the informational and legal pages so
 * they stay visually consistent with the homepage.
 */
export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="page-top-padding">
        {children}
        <FooterSection />
      </main>
    </>
  );
}
