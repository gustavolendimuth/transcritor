export const LANGUAGES = ['pt', 'en', 'es'] as const;

export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  pt: 'Português',
  en: 'Inglês',
  es: 'Espanhol',
};

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}
