import { SetMetadata } from '@nestjs/common';

export const PUBLIC_KEY = 'public';

/**
 * Opts a route out of `SessionAuthGuard`, which every route goes through by
 * default. Put it on single handlers, not on a controller: a new route should
 * have to ask for this.
 */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
