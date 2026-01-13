export type Locale = 'zh' | 'en'

export const translations = {
  zh: {
    // Hero section
    heroTitle1: '自由',
    heroTitle2: '创作',
    heroDescription: '享受友好的用户体验，让绘画变得轻松愉快。',
    artistsRecommend: '位艺术家推荐我们的应用',
    // Feature tags
    fast: '快速',
    customizable: '可定制',
    powerful: '强大',
    flexible: '灵活',
    intuitive: '直观',
    // CTA
    tryForFree: '免费试用',
    ctaDescription: '探索无限的画笔、颜色和纹理，让你的艺术栩栩如生。',
    averageRating: '平均评分',
    // Join room
    joinExistingRoom: '加入现有房间',
    enterRoomId: '输入房间 ID',
    join: '加入'
  },
  en: {
    // Hero section
    heroTitle1: 'IMAGINE',
    heroTitle2: 'FREELY',
    heroDescription: 'Enjoy a user-friendly experience that makes drawing easy and enjoyable.',
    artistsRecommend: 'artists recommend our app',
    // Feature tags
    fast: 'FAST',
    customizable: 'CUSTOMIZABLE',
    powerful: 'POWERFUL',
    flexible: 'FLEXIBLE',
    intuitive: 'INTUITIVE',
    // CTA
    tryForFree: 'TRY IT FOR FREE',
    ctaDescription: 'Explore endless brushes, colors, textures to bring your art to life.',
    averageRating: 'AVERAGE RATING',
    // Join room
    joinExistingRoom: 'Join Existing Room',
    enterRoomId: 'Enter Room ID',
    join: 'Join'
  }
} as const

export type TranslationKey = keyof (typeof translations)['zh']
