'use client'

import { createContext, useContext, useCallback, useMemo } from 'react'
import { type Locale, type TranslationKey, translations } from '@/lib/i18n'

interface LanguageContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey) => string
}

export const LanguageContext = createContext<LanguageContextValue | null>(null)

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

// Hook for creating language context value
export function useLanguageValue(locale: Locale, setLocale: (locale: Locale) => void): LanguageContextValue {
  const t = useCallback((key: TranslationKey) => translations[locale][key], [locale])

  return useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])
}
