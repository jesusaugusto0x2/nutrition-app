import type { Consultation } from '@nutri/schemas';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { t } from '@/i18n';
import type { RecordValues } from '../record-draft';
import { BmiBadge } from './bmi-badge';
import { RecordsTable } from './records-table';

function consultation(
  id: string,
  date: string,
  values: Partial<Consultation>,
): Consultation {
  return {
    id,
    patientId: '00000000-0000-4000-8000-000000000099',
    date,
    weightKg: 70,
    heightM: null,
    armCm: 30,
    waistCm: 90,
    legCm: 57,
    hipCm: 102,
    notes: null,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T10:00:00.000Z`,
    ...values,
  };
}

const consultations = [
  consultation('00000000-0000-4000-8000-000000000003', '2026-06-02', {
    weightKg: 66.9,
    waistCm: 85,
  }),
  consultation('00000000-0000-4000-8000-000000000002', '2026-04-07', {
    weightKg: 70.1,
  }),
  consultation('00000000-0000-4000-8000-000000000001', '2026-03-10', {
    weightKg: 72.4,
    heightM: 1.62,
    waistCm: 92,
  }),
];

function Editable({
  onSave,
}: {
  onSave: (id: string, v: RecordValues) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  return (
    <RecordsTable
      consultations={consultations}
      editingId={editingId}
      onEdit={setEditingId}
      onSave={onSave}
    />
  );
}

describe('RecordsTable', () => {
  it('lists consultations most recent first with their changes', () => {
    render(<Editable onSave={vi.fn()} />);
    const [, latest, , first] = screen.getAllByRole('row');

    expect(within(latest).getByText('02/06/2026')).toBeInTheDocument();
    expect(
      within(latest).getByText(t.consultations.latest),
    ).toBeInTheDocument();
    expect(within(latest).getByText('−3,2')).toBeInTheDocument();
    expect(within(first).getAllByText(t.consultations.initial).length).toBe(6);
  });

  it('shows the total change from the first to the last consultation', () => {
    render(<Editable onSave={vi.fn()} />);
    const rows = screen.getAllByRole('row');
    const footer = rows[rows.length - 1];
    expect(
      within(footer).getByText(t.consultations.totalChange),
    ).toBeInTheDocument();

    expect(within(footer).getByText('−5,5')).toBeInTheDocument();
    expect(within(footer).getByText('−7')).toBeInTheDocument();
  });

  it('corrects a record and recalculates its BMI live', () => {
    const onSave = vi.fn();
    render(<Editable onSave={onSave} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: t.consultations.editOf('02/06/2026'),
      }),
    );
    const weight = screen.getByRole('textbox', { name: 'Peso en kg' });
    expect(weight).toHaveValue('66,9');

    fireEvent.change(weight, { target: { value: '65,6' } });
    expect(screen.getByText('25,0')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: t.consultations.save }));
    expect(onSave).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000003',
      expect.objectContaining({
        date: '2026-06-02',
        weightKg: 65.6,
        waistCm: 85,
      }),
    );
  });

  it('cannot save a record without weight', () => {
    render(<Editable onSave={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: t.consultations.editOf('02/06/2026'),
      }),
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Peso en kg' }), {
      target: { value: '' },
    });

    expect(
      screen.getByRole('button', { name: t.consultations.save }),
    ).toBeDisabled();
  });

  it('cancels a correction', () => {
    render(<Editable onSave={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: t.consultations.editOf('02/06/2026'),
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: t.consultations.cancel }),
    );

    expect(
      screen.queryByRole('textbox', { name: 'Peso en kg' }),
    ).not.toBeInTheDocument();
  });
});

describe('BmiBadge', () => {
  it('shows the adult category', () => {
    render(<BmiBadge bmi={25.5} minor={false} />);
    expect(screen.getByText(t.bmi.categories.overweight)).toBeInTheDocument();
  });

  it('does not classify minors with adult categories', () => {
    render(<BmiBadge bmi={25.5} minor />);
    expect(screen.getByText(t.bmi.minor)).toBeInTheDocument();
  });
});
