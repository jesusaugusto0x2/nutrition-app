import { render, screen } from '@testing-library/react';
import { t } from '@/i18n';
import { initialsOf } from './avatar';
import { DiffIndicator } from './diff-indicator';
import { TrendBadge } from './trend-badge';

describe('initialsOf', () => {
  it('uses the first given name and the first surname', () => {
    expect(initialsOf('Ana Lucía', 'Pérez Gómez')).toBe('AP');
    expect(initialsOf(' élida ', 'ñañez')).toBe('ÉÑ');
  });
});

describe('TrendBadge', () => {
  it('says the change in words with its amount', () => {
    render(
      <>
        <TrendBadge change={-1.7} quantity="weight" />
        <TrendBadge change={0.8} quantity="weight" />
        <TrendBadge change={0.02} quantity="weight" />
      </>,
    );

    expect(screen.getByText(t.trend.down('1,7 kg'))).toBeInTheDocument();
    expect(screen.getByText(t.trend.up('0,8 kg'))).toBeInTheDocument();
    expect(screen.getByText(t.trend.none)).toBeInTheDocument();
  });
});

describe('DiffIndicator', () => {
  it('invites to type while the value is empty', () => {
    render(<DiffIndicator current={null} previous={66.9} quantity="weight" />);

    expect(screen.getByText(t.consultations.difference)).toBeInTheDocument();
  });

  it('shows the signed difference against the previous value', () => {
    const { rerender } = render(
      <DiffIndicator current={65.8} previous={66.9} quantity="weight" />,
    );
    expect(screen.getByText('−1,1 kg')).toBeInTheDocument();

    rerender(<DiffIndicator current={85.5} previous={85} quantity="length" />);
    expect(screen.getByText('+0,5 cm')).toBeInTheDocument();

    rerender(<DiffIndicator current={85} previous={85} quantity="length" />);
    expect(screen.getByText(t.consultations.noChange)).toBeInTheDocument();
  });
});
