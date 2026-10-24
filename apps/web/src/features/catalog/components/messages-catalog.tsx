import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { comingSoonItems } from '@/components/navigation/nav-items';
import { ComingSoonCard, EmptyState } from '@/components/ui/empty-state';
import { InfoNotice, SuccessNotice, UndoNotice } from '@/components/ui/notice';
import { SaveBar } from '@/components/ui/save-bar';
import { t } from '@/i18n';
import { catalog } from '../samples';
import { CatalogRow, CatalogSection } from './catalog-section';

const { components, samples } = catalog;

const features = [
  t.comingSoon.features.agenda,
  t.comingSoon.features.mealPlan,
  t.comingSoon.features.pdfReport,
  t.comingSoon.features.whatsapp,
];

export function MessagesCatalog() {
  const [removed, setRemoved] = useState(true);

  return (
    <>
      <CatalogSection id="success" title={components.success}>
        <SuccessNotice
          action={
            <a href="#records-table">{t.consultations.viewMeasurements}</a>
          }
        >
          {t.consultations.saved}
        </SuccessNotice>
      </CatalogSection>
      <CatalogSection id="undo" title={components.undo}>
        {removed ? (
          <UndoNotice onUndo={() => setRemoved(false)}>
            {samples.removed}
          </UndoNotice>
        ) : (
          <Button
            variant="danger"
            className="w-fit"
            onClick={() => setRemoved(true)}
          >
            <Trash2Icon aria-hidden />
            {samples.remove}
          </Button>
        )}
      </CatalogSection>
      <CatalogSection id="info" title={components.info}>
        <InfoNotice>{samples.notShown}</InfoNotice>
        <InfoNotice tone="clinical">{t.bmi.percentileNote}</InfoNotice>
      </CatalogSection>
      <CatalogSection id="empty" title={components.empty}>
        <EmptyState action={<a href="#text-field">{samples.createPatient}</a>}>
          {samples.noResults}
        </EmptyState>
      </CatalogSection>
      <CatalogSection id="coming-soon-card" title={components.comingSoonCard}>
        <div className="grid gap-5 md:grid-cols-2">
          {features.map((feature, index) => (
            <ComingSoonCard
              key={feature.title}
              icon={comingSoonItems[index].icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </CatalogSection>
      <CatalogSection id="save-bar" title={components.saveBar}>
        <div className="grid gap-5 md:grid-cols-3">
          <CatalogRow label={samples.saveBarStates.ready} className="block">
            <SaveBar
              label={t.consultations.saveConsultation}
              onSave={() => undefined}
              className="static rounded-card border"
            />
          </CatalogRow>
          <CatalogRow
            label={samples.saveBarStates.incomplete}
            className="block"
          >
            <SaveBar
              label={t.consultations.saveConsultation}
              missing={t.consultations.weightRequired}
              onSave={() => undefined}
              className="static rounded-card border"
            />
          </CatalogRow>
          <CatalogRow label={samples.saveBarStates.saved} className="block">
            <SaveBar
              label={t.consultations.saveConsultation}
              saved={t.consultations.saved}
              onSave={() => undefined}
              className="static rounded-card border"
            />
          </CatalogRow>
        </div>
      </CatalogSection>
    </>
  );
}
