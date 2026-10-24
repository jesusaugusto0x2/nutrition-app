import { render, screen } from '@testing-library/react';
import { FormField } from './form-field';
import { Input } from './input';

describe('FormField', () => {
  it('ties the visible label to the control', () => {
    render(
      <FormField label="Teléfono">
        {(control) => <Input {...control} type="tel" />}
      </FormField>,
    );

    expect(screen.getByLabelText('Teléfono')).toHaveAttribute('type', 'tel');
  });

  it('describes the control with its help text', () => {
    render(
      <FormField label="Guía" description="Opcional">
        {(control) => <Input {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText('Guía');
    expect(input).toHaveAccessibleDescription('Opcional');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('marks the control invalid and announces the error', () => {
    render(
      <FormField label="Contraseña" error="Escriba su contraseña.">
        {(control) => <Input {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Escriba su contraseña.');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Escriba su contraseña.',
    );
  });
});
