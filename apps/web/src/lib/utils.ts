import type { CnFunction } from 'cn';
import { createCn } from 'cn/config';

/**
 * Class merging aware of the design tokens in styles/globals.css. Without
 * them, custom sizes such as `text-meta` read as colors and a later
 * `text-primary` would silently drop them. Always import `cn` from here,
 * never from the `cn` package (generated shadcn components included).
 */
export const cn: CnFunction = createCn({
  extend: {
    theme: {
      text: [
        'body',
        'meta',
        'section',
        'display',
        'display-lg',
        'value',
        'value-lg',
      ],
      radius: ['field', 'button', 'button-lg', 'card', 'card-sm', 'nav'],
      spacing: ['touch', 'sidebar'],
      container: ['content'],
    },
  },
});
