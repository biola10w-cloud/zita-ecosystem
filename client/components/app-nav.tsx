import Link from 'next/link';
import { Home, Compass, Library, UserRound, MessageCircle } from 'lucide-react';

export function Brand({ href = '/' }: { href?: string }) {
  return <Link href={href} className="brand" aria-label="ZITA THE APP home"><span className="brand-mark">Z</span><span>ZITA THE APP</span></Link>;
}

export function AppNav({ active }: { active: 'home' | 'explore' | 'library' | 'profile' | 'community' }) {
  const items = [
    { id: 'home', href: '/', label: 'Home', Icon: Home },
    { id: 'explore', href: '/explore', label: 'Explore', Icon: Compass },
    { id: 'library', href: '/library', label: 'Library', Icon: Library },
    { id: 'community', href: '/community', label: 'Community', Icon: MessageCircle },
    { id: 'profile', href: '/dashboard', label: 'Profile', Icon: UserRound },
  ];
  return <nav className="bottom-nav" aria-label="App navigation">{items.map(({ id, href, label, Icon }) => <Link key={id} href={href} className={active === id ? 'nav-item active' : 'nav-item'} aria-current={active === id ? 'page' : undefined}><Icon size={22} aria-hidden="true" /><span>{label}</span></Link>)}</nav>;
}
