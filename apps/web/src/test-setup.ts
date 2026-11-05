import { configure } from '@testing-library/react';
// Adds DOM matchers (toBeInTheDocument, toHaveAttribute, ...) to Vitest.
import '@testing-library/jest-dom/vitest';

/*
 * `findBy*` and `waitFor` give up after 1 s by default. The first render of a
 * file loads the lazy routes, which takes longer than that while `pnpm test`
 * runs every project at once, or on a slow CI runner. A passing wait returns
 * as soon as it can, so a longer limit only slows down failures.
 */
configure({ asyncUtilTimeout: 5000 });
