export const SPLASH_VARIANTS = ["templates", "ai", "launcher"] as const;

export type SplashVariant = typeof SPLASH_VARIANTS[number];

const isSplashVariant = (value: unknown): value is SplashVariant =>
  typeof value === "string" &&
  (SPLASH_VARIANTS as readonly string[]).includes(value);

/**
 * Reads `VITE_APP_SPLASH_VARIANT`. Returns `null` when unset/invalid, in which
 * case the default welcome screen is rendered.
 */
export const getSplashVariant = (): SplashVariant | null => {
  const raw = import.meta.env.VITE_APP_SPLASH_VARIANT?.trim().toLowerCase();
  return isSplashVariant(raw) ? raw : null;
};

/** Whether the AI (text-to-diagram) backend is configured for this build. */
export const isAIEnabled = (): boolean =>
  Boolean(import.meta.env.VITE_APP_AI_BACKEND);
