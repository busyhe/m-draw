export const siteConfig = {
  name: 'M-Draw',
  url: 'https://draw.busyhe.com',
  ogImage:
    'https://og-image-craigary.vercel.app/**M-Draw**.png?theme=dark&md=1&fontSize=100px&images=https%3A%2F%2Fnobelium.vercel.app%2Flogo-for-dark-bg.svg',
  description: 'A collaborative whiteboard powered by tldraw',
  links: {
    homepage: 'https://busyhe.com',
    twitter: 'https://twitter.com/busyhe_',
    github: 'https://github.com/busyhe/m-draw'
  }
}

export type SiteConfig = typeof siteConfig

export const META_THEME_COLORS = {
  light: '#ffffff',
  dark: '#09090b'
}
