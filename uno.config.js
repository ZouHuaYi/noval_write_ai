import { defineConfig } from 'unocss'
import presetUno from '@unocss/preset-uno'
import presetAttributify from '@unocss/preset-attributify'
import presetIcons from '@unocss/preset-icons'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      collections: {
        carbon: () => import('@iconify-json/carbon/icons.json').then(i => i.default),
        mdi: () => import('@iconify-json/mdi/icons.json').then(i => i.default),
      }
    })
  ],
  shortcuts: {
    'btn': 'px-4 py-2 rounded cursor-pointer transition-colors',
    'btn-primary': 'btn bg-blue-500 text-white hover:bg-blue-600',
    'btn-secondary': 'btn bg-gray-500 text-white hover:bg-gray-600',

    // App structural components
    'app-surface': 'bg-[var(--app-surface)] border border-[var(--app-border)] rounded-[var(--app-radius)] shadow-[var(--app-shadow-sm)]',
    'app-panel': 'bg-[var(--app-surface)] border border-[var(--app-border)] rounded-[var(--app-radius)] shadow-[var(--app-shadow-sm)]',
    'app-muted': 'text-[var(--app-text-muted)]',
    'app-card': 'bg-[var(--app-surface)] border border-[var(--app-border)] rounded-[var(--app-radius)] shadow-[var(--app-shadow)] transition-transform transition-shadow transition-colors duration-200 ease hover:translate-y--2px hover:shadow-[0_16px_32px_rgba(32,30,25,0.12)] hover:border-[rgba(79,138,118,0.35)]',
    'app-section': 'bg-[var(--app-surface-muted)] border border-[var(--app-border)] rounded-[var(--app-radius)] transition-shadow transition-colors duration-200 ease hover:border-[rgba(79,138,118,0.28)] hover:shadow-[0_10px_24px_rgba(32,30,25,0.08)]',
    'app-header': 'bg-[var(--app-surface)] border-b border-[var(--app-border)] shadow-[0_6px_18px_rgba(32,30,25,0.06)]',
    'app-toolbar': 'bg-[var(--app-surface)] border border-[var(--app-border)] rounded-[var(--app-radius)]',

    // Workbench components
    'workbench-panel-header': 'bg-[var(--app-surface-muted)] rounded-t-[var(--app-radius)]',
    'workbench-panel-title': 'flex items-center gap-2.5',
    'workbench-section-title': 'font-600 text-[var(--app-text)]',
    'workbench-info-card': 'bg-[var(--app-surface-strong)] border border-[var(--app-border)] rounded-xl',
  }
})
