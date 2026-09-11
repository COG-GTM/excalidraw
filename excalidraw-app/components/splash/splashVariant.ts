export const SPLASH_VARIANTS = ["templates", "ai", "launcher"] as const;

export type SplashVariant = typeof SPLASH_VARIANTS[number];

/**
 * Splash variant selected through `VITE_APP_SPLASH_VARIANT`. Unset or
 * unrecognized values fall back to the default welcome screen.
 */
export const getSplashVariant = (): SplashVariant | null => {
  const value = import.meta.env.VITE_APP_SPLASH_VARIANT?.trim().toLowerCase();

  return SPLASH_VARIANTS.includes(value as SplashVariant)
    ? (value as SplashVariant)
    : null;
};

export const isAIEnabled = () => Boolean(import.meta.env.VITE_APP_AI_BACKEND);
