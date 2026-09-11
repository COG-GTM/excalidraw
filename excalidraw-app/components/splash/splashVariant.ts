export const SPLASH_VARIANTS = ["templates", "ai", "launcher"] as const;

export type SplashVariant = typeof SPLASH_VARIANTS[number];

const isSplashVariant = (value: string): value is SplashVariant =>
  (SPLASH_VARIANTS as readonly string[]).includes(value);

/**
 * Which welcome-screen splash to render, from `VITE_APP_SPLASH_VARIANT`.
 * `null` renders the default welcome screen.
 */
export const getSplashVariant = (): SplashVariant | null => {
  const value = (import.meta.env.VITE_APP_SPLASH_VARIANT || "")
    .trim()
    .toLowerCase();

  return isSplashVariant(value) ? value : null;
};

export const isAIEnabled = () => Boolean(import.meta.env.VITE_APP_AI_BACKEND);
