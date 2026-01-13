'use client'

import { Languages } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { useLanguage } from '@/hooks/use-language'

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage()

  const toggleLanguage = () => {
    setLocale(locale === 'zh' ? 'en' : 'zh')
  }

  return (
    <Button
      variant="ghost"
      className="h-8 w-8 px-0"
      onClick={toggleLanguage}
      title={locale === 'zh' ? 'Switch to English' : '切换到中文'}
    >
      <Languages className="size-4" />
      <span className="sr-only">{locale === 'zh' ? 'Switch to English' : '切换到中文'}</span>
    </Button>
  )
}
