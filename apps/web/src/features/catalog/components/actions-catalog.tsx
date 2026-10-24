import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChoiceField } from '@/components/ui/choice-field';
import { FilterChips } from '@/components/ui/filter-chips';
import { type YesNoAnswer, YesNoField } from '@/components/ui/yes-no-field';
import { catalog } from '../samples';
import { CatalogRow, CatalogSection } from './catalog-section';

const { components, labels, samples } = catalog;

export function ActionsCatalog() {
  return (
    <>
      <ButtonSection />
      <YesNoSection />
      <ChoiceSection />
      <ChipsSection />
    </>
  );
}

function ButtonSection() {
  return (
    <CatalogSection id="button" title={components.button}>
      <CatalogRow label={labels.variants}>
        <Button>
          <PlusIcon aria-hidden />
          {samples.newPatient}
        </Button>
        <Button variant="secondary">{samples.cancel}</Button>
        <Button variant="add">
          <PlusIcon aria-hidden />
          {samples.addCondition}
        </Button>
        <Button variant="danger">
          <Trash2Icon aria-hidden />
          {samples.remove}
        </Button>
        <Button variant="text">{samples.forgotPassword}</Button>
        <Button variant="text">{samples.seeAllPatients}</Button>
      </CatalogRow>
      <CatalogRow label={labels.sizes}>
        <Button size="lg">
          <CheckIcon aria-hidden />
          {samples.saveConsultation}
        </Button>
        <Button size="md">{samples.newPatient}</Button>
        <Button size="sm" variant="secondary">
          <PencilIcon aria-hidden />
          {samples.edit}
        </Button>
        <Button size="sm" variant="secondary">
          {samples.undo}
        </Button>
        <Button size="icon" aria-label={samples.newPatient}>
          <PlusIcon aria-hidden />
        </Button>
        <Button size="icon-sm" variant="secondary" aria-label={samples.newer}>
          <ChevronLeftIcon aria-hidden />
        </Button>
        <Button size="icon-sm" variant="secondary" aria-label={samples.older}>
          <ChevronRightIcon aria-hidden />
        </Button>
      </CatalogRow>
      <CatalogRow label={labels.disabled}>
        <span className="text-meta text-muted-foreground">
          {labels.disabledHint}
        </span>
        <Button size="lg" disabled>
          <CheckIcon aria-hidden />
          {samples.saveConsultation}
        </Button>
      </CatalogRow>
      <CatalogRow label={labels.fullWidth} className="max-w-[390px]">
        <Button size="lg" fullWidth>
          <PlusIcon aria-hidden />
          {samples.newPatient}
        </Button>
      </CatalogRow>
    </CatalogSection>
  );
}

function YesNoSection() {
  const [answers, setAnswers] = useState<YesNoAnswer[]>([null, 'yes', 'no']);
  const [extra, setExtra] = useState<YesNoAnswer>(null);
  const [extraVisible, setExtraVisible] = useState(true);

  return (
    <CatalogSection id="yes-no" title={components.yesNo}>
      <div className="flex max-w-[560px] flex-col divide-y divide-divider">
        {samples.conditions.slice(0, 2).map((condition, index) => (
          <YesNoField
            key={condition}
            label={condition}
            value={answers[index]}
            onChange={(value) =>
              setAnswers((current) =>
                current.map((answer, i) => (i === index ? value : answer)),
              )
            }
          />
        ))}
        {extraVisible ? (
          <YesNoField
            label={samples.conditions[2]}
            value={extra}
            onChange={setExtra}
            onRemove={() => setExtraVisible(false)}
          />
        ) : (
          <div className="py-3">
            <Button variant="add" onClick={() => setExtraVisible(true)}>
              <PlusIcon aria-hidden />
              {samples.addCondition}
            </Button>
          </div>
        )}
      </div>
    </CatalogSection>
  );
}

function ChoiceSection() {
  const [sex, setSex] = useState<'female' | 'male' | null>(null);
  const options = [
    { value: 'female', label: samples.female },
    { value: 'male', label: samples.male },
  ] as const;

  return (
    <CatalogSection id="choice" title={components.choice}>
      <ChoiceField
        label={samples.sex}
        options={options}
        value={sex}
        onChange={setSex}
        className="max-w-[440px]"
      />
    </CatalogSection>
  );
}

function ChipsSection() {
  const options = samples.measures.map((measure) => ({
    value: measure,
    label: measure,
  }));
  const [measure, setMeasure] = useState(options[0].value);

  return (
    <CatalogSection id="chips" title={components.chips}>
      <FilterChips
        label={samples.chartMeasure}
        options={options}
        value={measure}
        onChange={setMeasure}
        className="max-w-[390px]"
      />
    </CatalogSection>
  );
}
