import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import CookieBanner from './CookieBanner.vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(CookieBanner),
    })
  },
}
