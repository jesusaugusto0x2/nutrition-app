import { fireEvent, render, screen } from '@testing-library/react';
import { t } from '@/i18n';
import { PasswordInput } from './password-input';

describe('PasswordInput', () => {
  it('hides the password until the user asks to see it', () => {
    render(<PasswordInput aria-label="Contraseña" />);
    const input = screen.getByLabelText('Contraseña');

    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: t.forms.showPassword }));
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: t.forms.hidePassword }));
    expect(input).toHaveAttribute('type', 'password');
  });
});
