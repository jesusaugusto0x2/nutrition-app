import type { LinkProps } from '@tanstack/react-router';
import {
  BellIcon,
  CalendarDaysIcon,
  ClockIcon,
  FileTextIcon,
  HouseIcon,
  type LucideIcon,
  UsersIcon,
  UtensilsIcon,
} from 'lucide-react';
import { t } from '@/i18n';

export type NavKey = 'home' | 'patients' | 'comingSoon';

export interface NavItem {
  key: NavKey;
  label: string;
  icon: LucideIcon;
  /** Destination; items without one are not routed yet. */
  to?: LinkProps['to'];
}

export interface ComingSoonItem {
  label: string;
  icon: LucideIcon;
}

/**
 * Main destinations. Inicio points at `/`, which redirects to Pacientes
 * until the home screen exists; Próximamente gets its `to` with its route.
 */
export const mainNavItems: readonly NavItem[] = [
  { key: 'home', label: t.nav.home, icon: HouseIcon, to: '/' },
  { key: 'patients', label: t.nav.patients, icon: UsersIcon, to: '/patients' },
];

/** The phone bar adds Próximamente as a third destination. */
export const bottomNavItems: readonly NavItem[] = [
  ...mainNavItems,
  { key: 'comingSoon', label: t.nav.comingSoon, icon: ClockIcon },
];

/** Disabled entries under «Próximamente» in the sidebar. */
export const comingSoonItems: readonly ComingSoonItem[] = [
  { label: t.comingSoon.features.agenda.menu, icon: CalendarDaysIcon },
  { label: t.comingSoon.features.mealPlan.menu, icon: UtensilsIcon },
  { label: t.comingSoon.features.pdfReport.menu, icon: FileTextIcon },
  { label: t.comingSoon.features.whatsapp.menu, icon: BellIcon },
];
