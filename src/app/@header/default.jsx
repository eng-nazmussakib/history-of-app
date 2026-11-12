import SiteHeader from '@/components/SiteHeader.jsx';

// Routes without their own header page (404s, full reloads of unknown URLs).
export default function Header() {
  return <SiteHeader />;
}
