export const SPLASH_VARIANTS = ["templates", "ai", "launcher"] as const;
export type SplashVariant = typeof SPLASH_VARIANTS[number];

export const getSplashVariant = (): SplashVariant | null => {
  const variant = import.meta.env.VITE_APP_SPLASH_VARIANT?.trim().toLowerCase();

  return SPLASH_VARIANTS.includes(variant as SplashVariant)
    ? (variant as SplashVariant)
    : null;
};

export const isAIEnabled = () => Boolean(import.meta.env.VITE_APP_AI_BACKEND);
