/**
 * Legal notice data (French LCEN "mentions légales"). The publisher identity is
 * provided at build time through environment variables (Vercel > Settings >
 * Environment Variables) so no placeholder text is ever published.
 */
export const LEGAL = {
  publisher: (import.meta.env.VITE_LEGAL_PUBLISHER as string | undefined)?.trim() ?? '',
  contact: (import.meta.env.VITE_LEGAL_CONTACT as string | undefined)?.trim() ?? '',
  director: (import.meta.env.VITE_LEGAL_DIRECTOR as string | undefined)?.trim() ?? '',
  host: 'Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com',
};

export const APP_VERSION: string = __APP_VERSION__;
