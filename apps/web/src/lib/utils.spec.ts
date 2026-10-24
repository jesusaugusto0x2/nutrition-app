import { cn } from './utils';

describe('cn', () => {
  it('keeps custom font sizes next to text colors', () => {
    expect(cn('text-meta text-primary')).toBe('text-meta text-primary');
  });

  it('resolves conflicts between custom tokens of the same kind', () => {
    expect(cn('text-body text-meta')).toBe('text-meta');
    expect(cn('rounded-button rounded-nav')).toBe('rounded-nav');
    expect(cn('min-h-touch min-h-12')).toBe('min-h-12');
  });
});
