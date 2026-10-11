// Whose quiz this is. Tribe of Abraham by default (learn.tribeofabraham.com); the Ragamuffin Studios
// copy (learn.ragamuffinstudios.com) is built with `vite build --mode studios`, which reads
// .env.studios. The showcase pages get the same values from scripts/brand-static.mjs.
import toaLogo from './assets/LogoOnly.svg'
import studiosLogo from './assets/studios-logo.svg'

const env = import.meta.env
export const BRAND = {
  id: env.VITE_BRAND || 'toa',
  name: env.VITE_BRAND_NAME || 'Tribe of Abraham',
  app: env.VITE_APP_NAME || 'E-Learning',
  home: env.VITE_BRAND_HOME || 'https://tribeofabraham.com',
  logo: env.VITE_BRAND === 'studios' ? studiosLogo : toaLogo,
}
