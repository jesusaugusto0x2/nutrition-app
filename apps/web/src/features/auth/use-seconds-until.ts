import { useEffect, useState } from 'react';

/**
 * Whole seconds left until `deadline` (epoch milliseconds), updated every
 * second; 0 once it passed or when there is no deadline.
 */
export function useSecondsUntil(deadline: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) {
      return;
    }
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  return deadline === null
    ? 0
    : Math.max(0, Math.ceil((deadline - now) / 1000));
}
