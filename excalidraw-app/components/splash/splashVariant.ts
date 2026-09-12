export const SPLASH_VARIANTS = ["templates", "ai", "launcher"] as const;

export type SplashVariant = typeof SPLASH_VARIANTS[number];

const isSplashVariant = (value: string): value is SplashVariant =>
  (SPLASH_VARIANTS as readonly string[]).includes(value);

/**
 * Reads `VITE_APP_SPLASH_VARIANT`. Returns `null` when unset or invalid, in
 * which case the default welcome screen is rendered unchanged.
 */
export const getSplashVariant = (): SplashVariant | null => {
  const raw = import.meta.env.VITE_APP_SPLASH_VARIANT;
  if (!raw) {
    return null;
  }
  const value = raw.trim().toLowerCase();
  return isSplashVariant(value) ? value : null;
};

export const isAIEnabled = (): boolean =>
  Boolean(import.meta.env.VITE_APP_AI_BACKEND);
