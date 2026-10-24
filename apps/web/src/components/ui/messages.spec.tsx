import { fireEvent, render, screen } from '@testing-library/react';
import { t } from '@/i18n';
import { SuccessNotice, UndoNotice } from './notice';
import { SaveBar } from './save-bar';

describe('SuccessNotice', () => {
  it('is announced as a status', () => {
    render(<SuccessNotice>{t.consultations.saved}</SuccessNotice>);
    expect(screen.getByRole('status')).toHaveTextContent(t.consultations.saved);
  });
});

describe('UndoNotice', () => {
  it('undoes the last removal', () => {
    const onUndo = vi.fn();
    render(<UndoNotice onUndo={onUndo}>Se quitó «Diabetes».</UndoNotice>);

    fireEvent.click(screen.getByRole('button', { name: t.notices.undo }));

    expect(onUndo).toHaveBeenCalledOnce();
  });
});

describe('SaveBar', () => {
  it('cannot save while something is missing and says what', () => {
    render(
      <SaveBar
        label={t.consultations.saveConsultation}
        missing={t.consultations.weightRequired}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: t.consultations.saveConsultation }),
    ).toBeDisabled();
    expect(
      screen.getByText(t.consultations.weightRequired),
    ).toBeInTheDocument();
  });

  it('saves when ready', () => {
    const onSave = vi.fn();
    render(
      <SaveBar label={t.consultations.saveConsultation} onSave={onSave} />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: t.consultations.saveConsultation }),
    );

    expect(onSave).toHaveBeenCalledOnce();
  });
});
