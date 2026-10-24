import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ChoiceField } from './choice-field';
import { FilterChips } from './filter-chips';

const sexes = [
  { value: 'female', label: 'Femenino' },
  { value: 'male', label: 'Masculino' },
] as const;

describe('ChoiceField', () => {
  function Controlled() {
    const [value, setValue] = useState<'female' | 'male' | null>(null);
    return (
      <ChoiceField
        label="Sexo"
        options={sexes}
        value={value}
        onChange={setValue}
      />
    );
  }

  it('is a labelled radio group with nothing chosen at first', () => {
    render(<Controlled />);

    expect(
      screen.getByRole('radiogroup', { name: 'Sexo' }),
    ).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('chooses a single option', () => {
    render(<Controlled />);

    fireEvent.click(screen.getByRole('radio', { name: 'Femenino' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Masculino' }));

    expect(screen.getByRole('radio', { name: 'Masculino' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Femenino' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});

describe('FilterChips', () => {
  const measures = [
    { value: 'weight', label: 'Peso' },
    { value: 'waist', label: 'Cintura' },
  ] as const;

  function Controlled() {
    const [value, setValue] = useState<'weight' | 'waist'>('weight');
    return (
      <FilterChips
        label="Medida"
        options={measures}
        value={value}
        onChange={setValue}
      />
    );
  }

  it('switches the chosen chip', () => {
    render(<Controlled />);

    fireEvent.click(screen.getByRole('button', { name: 'Cintura' }));

    expect(screen.getByRole('button', { name: 'Cintura' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Peso' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('keeps a chip chosen when it is tapped again', () => {
    render(<Controlled />);

    fireEvent.click(screen.getByRole('button', { name: 'Peso' }));

    expect(screen.getByRole('button', { name: 'Peso' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
