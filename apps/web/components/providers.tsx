'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type Locale } from '@/lib/i18n'
import { LanguageContext, useLanguageValue } from '@/hooks/use-language'

const STORAGE_KEY = 'm-draw-locale'

function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>('zh')

  // Load saved locale on mount
  React.useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (saved && (saved === 'zh' || saved === 'en')) {
      setLocaleState(saved)
    }
  }, [])

  const setLocale = React.useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem(STORAGE_KEY, newLocale)
  }, [])

  const value = useLanguageValue(locale, setLocale)

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <LanguageProvider>{children}</LanguageProvider>
    </NextThemesProvider>
  )
}
