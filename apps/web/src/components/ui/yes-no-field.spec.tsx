import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { t } from '@/i18n';
import { type YesNoAnswer, YesNoField } from './yes-no-field';

function Controlled({ onRemove }: { onRemove?: () => void }) {
  const [value, setValue] = useState<YesNoAnswer>(null);
  return (
    <YesNoField
      label="Diabetes"
      value={value}
      onChange={setValue}
      onRemove={onRemove}
    />
  );
}

describe('YesNoField', () => {
  const yes = () => screen.getByRole('button', { name: t.common.yes });
  const no = () => screen.getByRole('button', { name: t.common.no });

  it('starts unanswered', () => {
    render(<Controlled />);

    expect(screen.getByText(t.forms.unanswered)).toBeInTheDocument();
    expect(yes()).toHaveAttribute('aria-pressed', 'false');
    expect(no()).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks one answer at a time', () => {
    render(<Controlled />);

    fireEvent.click(yes());
    expect(yes()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(t.forms.unanswered)).not.toBeInTheDocument();

    fireEvent.click(no());
    expect(no()).toHaveAttribute('aria-pressed', 'true');
    expect(yes()).toHaveAttribute('aria-pressed', 'false');
  });

  it('clears the answer when the chosen one is tapped again', () => {
    render(<Controlled />);

    fireEvent.click(yes());
    fireEvent.click(yes());

    expect(yes()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(t.forms.unanswered)).toBeInTheDocument();
  });

  it('groups the answers under the question name', () => {
    render(<Controlled />);

    expect(screen.getByRole('group', { name: 'Diabetes' })).toBeInTheDocument();
  });

  it('offers removal only for removable items', () => {
    const onRemove = vi.fn();
    const { unmount } = render(<Controlled />);
    expect(
      screen.queryByRole('button', { name: /Quitar/ }),
    ).not.toBeInTheDocument();
    unmount();

    render(<Controlled onRemove={onRemove} />);
    fireEvent.click(
      screen.getByRole('button', { name: `${t.common.remove} Diabetes` }),
    );
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
