export const SPLASH_VARIANTS = ["templates", "ai", "launcher"] as const;

export type SplashVariant = typeof SPLASH_VARIANTS[number];

/**
 * Welcome-screen splash variant selected via `VITE_APP_SPLASH_VARIANT`.
 * Returns `null` when unset or unknown, meaning the default welcome screen.
 */
export const getSplashVariant = (): SplashVariant | null => {
  const value = (import.meta.env.VITE_APP_SPLASH_VARIANT || "")
    .trim()
    .toLowerCase();

  return SPLASH_VARIANTS.includes(value as SplashVariant)
    ? (value as SplashVariant)
    : null;
};

export const isAIEnabled = () => Boolean(import.meta.env.VITE_APP_AI_BACKEND);
