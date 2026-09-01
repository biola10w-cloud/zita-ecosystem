import fs from 'fs';
import { config } from '../../config';

/**
 * Resolves a PEM key from either an inline env var (preferred for hosts
 * where shipping a keys/ file isn't practical) or a file path (preferred
 * for local development). Throws a clear error if neither is set.
 */
function resolveKey(inline: string | undefined, path: string | undefined, label: string): string {
  if (inline) return inline.replace(/\\n/g, '\n');
  if (path) return fs.readFileSync(path, 'utf8');

  throw new Error(
    `Missing ${label} — set either the inline PEM env variable or the *_PATH file variable`,
  );
}

export const jwtPrivateKey = resolveKey(
  config.JWT_PRIVATE_KEY,
  config.JWT_PRIVATE_KEY_PATH,
  'JWT_PRIVATE_KEY(_PATH)',
);

export const jwtPublicKey = resolveKey(
  config.JWT_PUBLIC_KEY,
  config.JWT_PUBLIC_KEY_PATH,
  'JWT_PUBLIC_KEY(_PATH)',
);
