import { calculateBmi } from '@nutri/utils';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { InitialsAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DiffIndicator } from '@/components/ui/diff-indicator';
import { EvolutionChart } from '@/components/ui/evolution-chart';
import { StatCard } from '@/components/ui/stat-card';
import { TrendBadge } from '@/components/ui/trend-badge';
import { UnitInput } from '@/components/ui/unit-input';
import { BmiBadge } from '@/features/consultations/components/bmi-badge';
import { BmiResult } from '@/features/consultations/components/bmi-result';
import { ConsultationNote } from '@/features/consultations/components/consultation-note';
import {
  RecordCards,
  TotalChangeCard,
} from '@/features/consultations/components/record-cards';
import { RecordsTable } from '@/features/consultations/components/records-table';
import type { RecordValues } from '@/features/consultations/record-draft';
import { PatientHeader } from '@/features/patients/components/patient-header';
import {
  PatientRow,
  PatientTable,
} from '@/features/patients/components/patient-row';
import { t } from '@/i18n';
import { formatQuantityChange, formatQuantityWithUnit } from '@/lib/format';
import { parseDecimalInput } from '@/lib/parse';
import {
  sampleConsultations,
  sampleMinor,
  samplePatient,
  sampleSummaries,
} from '../sample-records';
import { catalog } from '../samples';
import { CatalogRow, CatalogSection } from './catalog-section';

const { components, labels, samples } = catalog;

export function DataCatalog() {
  return (
    <>
      <CardSection />
      <AvatarSection />
      <PatientHeaderSection />
      <PatientRowSection />
      <BadgesSection />
      <DiffSection />
      <StatSection />
      <ChartSection />
      <RecordsSection />
      <NoteSection />
    </>
  );
}

function CardSection() {
  return (
    <CatalogSection id="card" title={components.card}>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h4">{samples.cardTitle}</CardTitle>
            <CardAction>
              <a href="#records-table">{samples.cardAction}</a>
            </CardAction>
          </CardHeader>
          <CardContent>{samples.cardBody}</CardContent>
        </Card>
        <Card variant="featured">
          <CardTitle as="h4">{samples.featured}</CardTitle>
        </Card>
        <Card variant="soft">
          <CardTitle as="h4">{samples.soft}</CardTitle>
        </Card>
        <Card variant="dashed">
          <CardTitle as="h4">{samples.dashed}</CardTitle>
        </Card>
      </div>
    </CatalogSection>
  );
}

function AvatarSection() {
  return (
    <CatalogSection id="avatar" title={components.avatar}>
      <CatalogRow label={labels.sizes}>
        <InitialsAvatar firstName="Laura" lastName="Méndez" />
        <InitialsAvatar firstName="Laura" lastName="Méndez" size="lg" />
      </CatalogRow>
    </CatalogSection>
  );
}

function PatientHeaderSection() {
  const action = (
    <a href="#records-table" className={buttonVariants({ size: 'lg' })}>
      <PlusIcon aria-hidden />
      {t.consultations.newConsultation}
    </a>
  );

  return (
    <CatalogSection id="patient-header" title={components.patientHeader}>
      <CatalogRow label={samples.adult} className="block">
        <PatientHeader
          patient={samplePatient}
          currentBmi={25.5}
          action={action}
        />
      </CatalogRow>
      <CatalogRow label={samples.minor} className="block">
        <PatientHeader
          patient={sampleMinor}
          currentBmi={17.9}
          action={action}
        />
      </CatalogRow>
      <CatalogRow label={samples.compact} className="block">
        <PatientHeader patient={samplePatient} compact />
      </CatalogRow>
    </CatalogSection>
  );
}

function PatientRowSection() {
  const [first] = sampleSummaries;

  return (
    <CatalogSection id="patient-row" title={components.patientRow}>
      <div className="grid gap-5 md:grid-cols-2">
        <CatalogRow
          label={samples.rowVariants.list}
          className="flex-col items-stretch"
        >
          {sampleSummaries.map((summary) => (
            <PatientRow
              key={summary.patient.id}
              summary={summary}
              variant="list"
            />
          ))}
        </CatalogRow>
        <div className="flex flex-col gap-5">
          <CatalogRow
            label={samples.rowVariants.recent}
            className="flex-col items-stretch"
          >
            <PatientRow summary={first} variant="recent" />
          </CatalogRow>
          <CatalogRow
            label={samples.rowVariants.today}
            className="flex-col items-stretch"
          >
            <PatientRow summary={first} variant="today" time="09:15" />
          </CatalogRow>
          <CatalogRow
            label={samples.rowVariants.search}
            className="flex-col items-stretch"
          >
            <div className="rounded-card-sm border bg-surface">
              {sampleSummaries.slice(0, 2).map((summary) => (
                <PatientRow
                  key={summary.patient.id}
                  summary={summary}
                  variant="search"
                />
              ))}
            </div>
          </CatalogRow>
        </div>
      </div>
      <CatalogRow label={samples.rowVariants.table} className="block">
        <PatientTable summaries={sampleSummaries} />
      </CatalogRow>
    </CatalogSection>
  );
}

function BadgesSection() {
  return (
    <>
      <CatalogSection id="trend" title={components.trend}>
        <CatalogRow label={labels.variants}>
          <TrendBadge change={-1.7} quantity="weight" />
          <TrendBadge change={0.8} quantity="weight" />
          <TrendBadge change={0} quantity="weight" />
        </CatalogRow>
      </CatalogSection>
      <CatalogSection id="classification" title={components.classification}>
        <CatalogRow label={t.bmi.label}>
          {[17.9, 22.4, 27.6, 31.2, 36.5, 41].map((bmi) => (
            <BmiBadge key={bmi} bmi={bmi} minor={false} />
          ))}
          <BmiBadge bmi={17.9} minor />
        </CatalogRow>
        <CatalogRow label={labels.variants}>
          {samples.diagnoses.map((diagnosis) => (
            <Badge key={diagnosis} tone="info" size="lg">
              {diagnosis}
            </Badge>
          ))}
          <Badge tone="primary">{samples.today}</Badge>
          <Badge tone="neutral">{samples.comingSoon}</Badge>
        </CatalogRow>
      </CatalogSection>
    </>
  );
}

function DiffSection() {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('1,62');
  const weightValue = parseDecimalInput(weight);
  const heightValue = parseDecimalInput(height);
  const bmi =
    weightValue && heightValue ? calculateBmi(weightValue, heightValue) : null;

  return (
    <>
      <CatalogSection id="diff" title={components.diff}>
        <div className="flex max-w-[560px] flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label
              htmlFor="catalog-diff-weight"
              className="text-section font-bold"
            >
              {samples.weight}
            </label>
            <span className="text-muted-foreground">
              {samples.previousWeight}
            </span>
          </div>
          <div className="flex items-stretch gap-3.5">
            <UnitInput
              id="catalog-diff-weight"
              variant="featured"
              unit={t.units.kilograms}
              placeholder="0,0"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
            />
            <DiffIndicator
              current={weightValue}
              previous={66.9}
              quantity="weight"
              size="lg"
            />
          </div>
        </div>
        <CatalogRow label={labels.states}>
          <DiffIndicator
            current={null}
            previous={85}
            quantity="length"
            className="h-15"
          />
          <DiffIndicator
            current={84}
            previous={85}
            quantity="length"
            className="h-15"
          />
          <DiffIndicator
            current={85.5}
            previous={85}
            quantity="length"
            className="h-15"
          />
          <DiffIndicator
            current={85}
            previous={85}
            quantity="length"
            className="h-15"
          />
        </CatalogRow>
      </CatalogSection>
      <CatalogSection id="bmi-result" title={components.bmiResult}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="catalog-bmi-height" className="font-bold">
              {samples.height}
            </label>
            <UnitInput
              id="catalog-bmi-height"
              unit={t.units.meters}
              value={height}
              onChange={(event) => setHeight(event.target.value)}
            />
          </div>
          <BmiResult bmi={bmi} minor={false} />
          <BmiResult bmi={17.9} minor />
        </div>
      </CatalogSection>
    </>
  );
}

function StatSection() {
  return (
    <CatalogSection id="stat" title={components.stat}>
      <div className="grid gap-5 md:grid-cols-3">
        <StatCard
          label={samples.initialWeight}
          value={formatQuantityWithUnit(72.4, 'weight')}
          context={samples.initialContext}
        />
        <StatCard
          label={samples.currentWeight}
          value={formatQuantityWithUnit(66.9, 'weight')}
          context={samples.currentContext}
        />
        <StatCard
          variant="down"
          label={samples.totalLost}
          value={formatQuantityWithUnit(5.5, 'weight')}
          context={samples.totalLostContext}
        />
      </div>
      <div className="grid gap-3.5 md:grid-cols-4">
        <StatCard
          variant="mini"
          label={samples.waist}
          value={formatQuantityChange(-7, 'length')}
          context={samples.waistContext}
        />
      </div>
    </CatalogSection>
  );
}

function ChartSection() {
  const chronological = [...sampleConsultations].reverse();
  const weight = chronological.map((c) => ({
    date: c.date,
    value: c.weightKg,
  }));
  const waist = chronological.map((c) => ({
    date: c.date,
    value: c.waistCm ?? 0,
  }));

  return (
    <CatalogSection id="chart" title={components.chart}>
      <EvolutionChart
        title={samples.weightChart}
        points={weight}
        quantity="weight"
        size="lg"
      />
      <div className="grid gap-5 md:grid-cols-2">
        <EvolutionChart
          title={samples.waistChart}
          points={waist}
          quantity="length"
        />
        <EvolutionChart
          title={samples.weightChart}
          points={weight}
          quantity="weight"
          size="summary"
          action={
            <a href="#records-table" className="font-bold">
              {samples.cardAction}
            </a>
          }
        />
      </div>
      <CatalogRow label={samples.oneConsultation} className="block">
        <EvolutionChart
          title={samples.waistChart}
          points={waist.slice(0, 1)}
          quantity="length"
        />
      </CatalogRow>
    </CatalogSection>
  );
}

function RecordsSection() {
  const [records, setRecords] = useState(sampleConsultations);
  const [editingId, setEditingId] = useState<string | null>(null);
  const save = (id: string, values: RecordValues) => {
    setRecords((current) =>
      current.map((record) =>
        record.id === id ? { ...record, ...values } : record,
      ),
    );
    setEditingId(null);
  };

  return (
    <>
      <CatalogSection id="records-table" title={components.recordsTable}>
        <div className="overflow-hidden rounded-card border">
          <RecordsTable
            consultations={records}
            editingId={editingId}
            onEdit={setEditingId}
            onSave={save}
          />
        </div>
      </CatalogSection>
      <CatalogSection id="record-card" title={components.recordCard}>
        <div className="flex max-w-[390px] flex-col gap-3">
          <RecordCards
            consultations={records}
            range={[0, 2]}
            editingId={editingId}
            onEdit={setEditingId}
            onSave={save}
          />
          <TotalChangeCard consultations={records} />
        </div>
      </CatalogSection>
    </>
  );
}

function NoteSection() {
  return (
    <CatalogSection id="note" title={components.note}>
      <div className="max-w-[720px]">
        {sampleConsultations
          .filter((consultation) => consultation.notes)
          .map((consultation) => (
            <ConsultationNote
              key={consultation.id}
              consultation={consultation}
            />
          ))}
      </div>
    </CatalogSection>
  );
}
