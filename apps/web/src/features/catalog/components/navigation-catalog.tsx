import { useState } from 'react';
import { BackLink } from '@/components/navigation/back-link';
import { BottomNav } from '@/components/navigation/bottom-nav';
import { Brand } from '@/components/navigation/brand';
import { Sidebar } from '@/components/navigation/sidebar';
import { Pagination } from '@/components/ui/pagination';
import { SectionTabs } from '@/components/ui/section-tabs';
import { t } from '@/i18n';
import { catalog } from '../samples';
import { CatalogRow, CatalogSection } from './catalog-section';

const { components, samples } = catalog;

type ProfileTab = 'summary' | 'history' | 'measurements' | 'notes';

const profileTabs = (
  ['summary', 'history', 'measurements', 'notes'] as const
).map((value) => ({ value, label: t.profileTabs[value] }));

export function NavigationCatalog() {
  const [tab, setTab] = useState<ProfileTab>('summary');
  const [page, setPage] = useState(1);

  return (
    <>
      <CatalogSection id="brand" title={components.brand}>
        <CatalogRow label={samples.brandVariants.compact}>
          <Brand variant="compact" />
        </CatalogRow>
        <CatalogRow label={samples.brandVariants.menu}>
          <Brand variant="menu" />
        </CatalogRow>
        <CatalogRow label={samples.brandVariants.boxed}>
          <Brand variant="boxed" />
        </CatalogRow>
        <CatalogRow label={samples.brandVariants.inverted}>
          <div className="rounded-card bg-primary p-6">
            <Brand variant="inverted" />
          </div>
        </CatalogRow>
      </CatalogSection>
      <CatalogSection id="sidebar" title={components.sidebar}>
        <div className="w-sidebar overflow-hidden rounded-card border">
          <Sidebar activeKey="patients" className="border-r-0" />
        </div>
      </CatalogSection>
      <CatalogSection id="bottom-nav" title={components.bottomNav}>
        <div className="max-w-[390px] overflow-hidden rounded-card border">
          <BottomNav activeKey="patients" className="static" />
        </div>
      </CatalogSection>
      <CatalogSection id="back-link" title={components.backLink}>
        <BackLink to="/patients" label={t.nav.patients} />
        <BackLink
          to="/patients/$patientId"
          params={{ patientId: '00000000-0000-4000-8000-0000000000a1' }}
          label={samples.backToProfile}
        />
      </CatalogSection>
      <CatalogSection id="tabs" title={components.tabs}>
        <SectionTabs
          label={t.profileTabs.label}
          items={profileTabs}
          value={tab}
          onChange={setTab}
        />
      </CatalogSection>
      <CatalogSection id="pagination" title={components.pagination}>
        <Pagination
          page={page}
          perPage={3}
          total={7}
          items={t.consultations.items}
          onPageChange={setPage}
        />
      </CatalogSection>
    </>
  );
}
