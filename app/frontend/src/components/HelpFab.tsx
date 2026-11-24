import { useLocation, useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { guideSectionForPath } from '@/constants/userGuide';

/**
 * Floating contextual-help button. On every page it opens the user guide at the
 * section that documents the current route (/help#<section>). Hidden on the
 * guide page itself and on the POS screen (to keep the cashier UI clean).
 */
export function HelpFab() {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname.startsWith('/help') || location.pathname === '/sales/new') {
    return null;
  }

  const section = guideSectionForPath(location.pathname);
  const target = section ? `/help#${section.id}` : '/help';
  const label = section ? `مساعدة: ${section.title}` : 'دليل المستخدم';

  return (
    <button
      onClick={() => navigate(target)}
      title={label}
      aria-label={label}
      className="fixed bottom-6 left-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      <HelpCircle className="h-6 w-6" />
    </button>
  );
}
