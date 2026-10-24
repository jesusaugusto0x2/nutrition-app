import { calculateAge } from '@nutri/utils';
import { useId, useState } from 'react';
import { CheckboxField } from '@/components/ui/checkbox';
import { ComputedValue } from '@/components/ui/computed-value';
import { FieldError } from '@/components/ui/field';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { SearchInput } from '@/components/ui/search-input';
import { Textarea } from '@/components/ui/textarea';
import { UnitInput } from '@/components/ui/unit-input';
import { t } from '@/i18n';
import { formatQuantityWithUnit } from '@/lib/format';
import { matchesSearch, parseDateInput, parseHeightInput } from '@/lib/parse';
import { catalog } from '../samples';
import { CatalogRow, CatalogSection } from './catalog-section';

const { components, labels, samples } = catalog;

const grid = 'grid gap-5 md:grid-cols-2';

export function FormsCatalog() {
  return (
    <>
      <TextFieldSection />
      <UnitFieldSection />
      <PasswordSection />
      <SearchSection />
      <TextareaSection />
      <ComputedSection />
      <CheckboxSection />
      <FieldErrorSection />
    </>
  );
}

function TextFieldSection() {
  return (
    <CatalogSection id="text-field" title={components.textField}>
      <div className={grid}>
        <FormField label={samples.fullName}>
          {(control) => (
            <Input {...control} placeholder={samples.fullNamePlaceholder} />
          )}
        </FormField>
        <FormField label={samples.birthDate}>
          {(control) => (
            <Input
              {...control}
              inputMode="numeric"
              placeholder={t.forms.datePlaceholder}
            />
          )}
        </FormField>
        <FormField label={samples.phone}>
          {(control) => (
            <Input {...control} type="tel" defaultValue="0412 555 0101" />
          )}
        </FormField>
        <FormField label={samples.email} error={samples.emailError}>
          {(control) => (
            <Input
              {...control}
              inputMode="email"
              autoComplete="email"
              placeholder={samples.emailPlaceholder}
              defaultValue="laura@correo"
            />
          )}
        </FormField>
      </div>
      <CatalogRow label={labels.variants} className="max-w-[240px]">
        <Input
          size="table"
          aria-label={samples.tableCell}
          defaultValue="66,9"
        />
      </CatalogRow>
    </CatalogSection>
  );
}

function UnitFieldSection() {
  const [height, setHeight] = useState('162');
  const parsedHeight = parseHeightInput(height);

  return (
    <CatalogSection id="unit-field" title={components.unitField}>
      <div className={grid}>
        <FormField label={samples.weight}>
          {(control) => (
            <UnitInput
              {...control}
              unit={t.units.kilograms}
              placeholder="0,0"
            />
          )}
        </FormField>
        <FormField
          label={samples.height}
          description={
            parsedHeight
              ? `${samples.heightHelp} → ${formatQuantityWithUnit(parsedHeight, 'height')}`
              : samples.heightHelp
          }
        >
          {(control) => (
            <UnitInput
              {...control}
              unit={t.units.meters}
              value={height}
              onChange={(event) => setHeight(event.target.value)}
            />
          )}
        </FormField>
        <FormField label={samples.weight} hint={samples.previousWeight}>
          {(control) => (
            <UnitInput
              {...control}
              variant="featured"
              unit={t.units.kilograms}
              placeholder="0,0"
            />
          )}
        </FormField>
        <FormField label={samples.waist}>
          {(control) => (
            <UnitInput
              {...control}
              variant="measure"
              unit={t.units.centimeters}
              placeholder="0"
            />
          )}
        </FormField>
      </div>
      <CatalogRow label={labels.variants} className="max-w-[200px]">
        <UnitInput
          variant="table"
          unit={t.units.kilograms}
          aria-label={samples.tableCell}
          defaultValue="66,9"
        />
      </CatalogRow>
    </CatalogSection>
  );
}

function PasswordSection() {
  return (
    <CatalogSection id="password" title={components.password}>
      <div className={grid}>
        <FormField label={samples.password}>
          {(control) => <PasswordInput {...control} defaultValue="secreta" />}
        </FormField>
        <FormField label={samples.password} error={samples.passwordError}>
          {(control) => <PasswordInput {...control} />}
        </FormField>
      </div>
    </CatalogSection>
  );
}

const demoPatients = [
  'Ana Lucía Pérez',
  'José Gregorio Blanco',
  'Sofía Herrera',
  'Laura Méndez',
];

function SearchSection() {
  const [query, setQuery] = useState('');
  const results = query
    ? demoPatients.filter((name) => matchesSearch(name, query))
    : [];

  return (
    <CatalogSection id="search" title={components.search}>
      <div className="flex max-w-[560px] flex-col gap-2.5">
        <FormField label={samples.searchPatient}>
          {(control) => (
            <SearchInput
              {...control}
              placeholder={samples.searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          )}
        </FormField>
        {query && (
          <ul className="rounded-card-sm border bg-surface">
            {results.map((name) => (
              <li
                key={name}
                className="border-b border-divider px-4 py-3 last:border-0"
              >
                {name}
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-4 py-3">{samples.noResults}</li>
            )}
          </ul>
        )}
      </div>
    </CatalogSection>
  );
}

function TextareaSection() {
  return (
    <CatalogSection id="textarea" title={components.textarea}>
      <FormField label={samples.notes} className="max-w-[720px]">
        {(control) => (
          <Textarea {...control} placeholder={samples.notesPlaceholder} />
        )}
      </FormField>
    </CatalogSection>
  );
}

function ComputedSection() {
  const birthId = useId();
  const [birthDate, setBirthDate] = useState('14/03/1988');
  const iso = parseDateInput(birthDate);
  let age: string | null = null;
  try {
    age = iso ? t.patients.age(calculateAge(iso)) : null;
  } catch {
    // A birth date in the future has no age yet.
  }

  return (
    <CatalogSection id="computed" title={components.computed}>
      <div className={grid}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={birthId} className="text-base font-bold">
            {samples.birthDate}
          </label>
          <Input
            id={birthId}
            inputMode="numeric"
            placeholder={t.forms.datePlaceholder}
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </div>
        <ComputedValue label={samples.age} value={age} htmlFor={birthId} />
      </div>
    </CatalogSection>
  );
}

function CheckboxSection() {
  const [checked, setChecked] = useState(true);

  return (
    <CatalogSection id="checkbox" title={components.checkbox}>
      <CheckboxField
        label={samples.keepSession}
        checked={checked}
        onCheckedChange={setChecked}
      />
    </CatalogSection>
  );
}

function FieldErrorSection() {
  return (
    <CatalogSection id="field-error" title={components.fieldError}>
      <FieldError>{samples.passwordError}</FieldError>
      <FieldError>{samples.emailError}</FieldError>
    </CatalogSection>
  );
}
