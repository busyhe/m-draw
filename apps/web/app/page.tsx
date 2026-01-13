'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Star, Users } from 'lucide-react'
import { useTotalUsers, useLanguage } from '@/hooks'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

// Decorative curves SVG component
function DecorativeCurves() {
  return (
    <svg className="w-full h-48 md:h-64" viewBox="0 0 800 200" fill="none" preserveAspectRatio="xMidYMid meet">
      {/* Dark curve */}
      <path
        d="M50 150 Q150 50, 250 120 T450 80"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="text-foreground"
        fill="none"
      />
      {/* Medium gray curve */}
      <path
        d="M200 180 Q350 20, 500 100 T700 60"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="text-foreground/40"
        fill="none"
      />
      {/* Light gray curve */}
      <path
        d="M400 160 Q550 40, 650 120 T800 80"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="text-foreground/20"
        fill="none"
      />
    </svg>
  )
}

// Star rating component
function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5

  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          size={16}
          className={
            i < fullStars
              ? 'fill-yellow-400 text-yellow-400'
              : i === fullStars && hasHalfStar
                ? 'fill-yellow-400/50 text-yellow-400'
                : 'text-gray-300'
          }
        />
      ))}
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [roomId, setRoomId] = useState('')
  const totalUsers = useTotalUsers()
  const { t } = useLanguage()

  // Feature tags using translations
  const featureTags = [t('fast'), t('customizable'), t('powerful'), t('flexible'), t('intuitive')]

  const createRoom = () => {
    const id = crypto.randomUUID()
    router.push(`/room/${id}`)
  }

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (roomId.trim()) {
      router.push(`/room/${roomId.trim()}`)
    }
  }

  return (
    <div data-wrapper="" className="border-grid flex flex-1 flex-col min-h-svh">
      <SiteHeader />
      <main className="flex flex-1 flex-col bg-landing-bg">
        <div className="container-wrapper">
          <div className="container py-8 md:py-12">
            {/* Hero Section */}
            <section className="relative">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
                {/* Left: Title and description */}
                <div className="flex-1">
                  <h1 className="text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-black leading-none tracking-tight text-foreground">
                    {t('heroTitle1')}
                    <br />
                    {t('heroTitle2')}
                  </h1>
                  <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-sm">{t('heroDescription')}</p>
                </div>

                {/* Right: User stats */}
                <div className="flex items-center gap-3 lg:pt-4">
                  {/* Avatar group */}
                  <div className="flex -space-x-2">
                    <div className="w-10 h-10 rounded-full bg-orange-400 border-2 border-landing-bg" />
                    <div className="w-10 h-10 rounded-full bg-emerald-400 border-2 border-landing-bg" />
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">
                      +{totalUsers !== null ? totalUsers.toLocaleString() : '200,000'}
                    </span>
                    <br />
                    {t('artistsRecommend')}
                  </div>
                </div>
              </div>
            </section>

            {/* Decorative Curves */}
            <section className="my-4 md:my-8">
              <DecorativeCurves />
            </section>

            {/* Feature Tags and CTA Section */}
            <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
              {/* Left: Tags and CTA card */}
              <div className="space-y-6">
                {/* Feature Tags */}
                <div className="flex flex-wrap gap-2">
                  {featureTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-4 py-2 text-xs font-medium border border-foreground/30 rounded-full text-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* CTA Card */}
                <div
                  onClick={createRoom}
                  className="group relative bg-landing-accent rounded-2xl p-6 cursor-pointer hover:opacity-90 transition-opacity max-w-xs"
                >
                  <h3 className="text-lg font-bold text-landing-accent-foreground mb-1">{t('tryForFree')}</h3>
                  <p className="text-sm text-landing-accent-foreground/80">{t('ctaDescription')}</p>
                  <div className="absolute top-4 right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ArrowUpRight size={20} className="text-landing-accent" />
                  </div>
                </div>
              </div>

              {/* Right: Device showcase */}
              <div className="relative">
                {/* Device mockup */}
                <div className="relative w-64 h-48 bg-linear-to-br from-sky-200 to-sky-400 rounded-lg shadow-xl overflow-hidden">
                  <div className="absolute inset-0 bg-linear-to-t from-green-300/50 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-linear-to-t from-amber-200/70 to-transparent" />
                </div>
                {/* Rating badge */}
                <div className="absolute -bottom-4 -right-4 bg-white rounded-xl shadow-lg p-3 flex flex-col items-center gap-1">
                  <StarRating rating={4.9} />
                  <span className="text-xs font-bold text-foreground">4.9/5 {t('averageRating')}</span>
                </div>
              </div>
            </section>

            {/* Join Room Section */}
            <section className="mt-12 pt-8 border-t border-foreground/10">
              <div className="max-w-md mx-auto">
                <h2 className="text-xl font-bold text-center mb-4">{t('joinExistingRoom')}</h2>
                <form onSubmit={joinRoom} className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                      <Users size={18} />
                    </div>
                    <input
                      type="text"
                      id="roomId"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      placeholder={t('enterRoomId')}
                      className="block w-full pl-10 pr-3 py-3 border border-foreground/20 rounded-lg bg-white/80 placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-landing-accent focus:border-transparent text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!roomId.trim()}
                    className="px-6 py-3 bg-foreground text-background font-semibold rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('join')}
                  </button>
                </form>
              </div>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
