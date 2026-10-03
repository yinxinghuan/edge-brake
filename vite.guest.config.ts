import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const root = path.dirname(fileURLToPath(import.meta.url))
const catalogDest = path.join(root, 'src/guest/generated/catalog.en.json')

function stripCjk(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/[\u3400-\u9fff]/g, '')
  if (Array.isArray(value)) return value.map(stripCjk)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of Object.keys(record)) record[key] = stripCjk(record[key])
  }
  return value
}

function writeEnglishCatalog() {
  const source = JSON.parse(fs.readFileSync(path.join(root, 'src/assets/characters/ASSETS.json'), 'utf8')) as {
    assets?: Array<{ name_zh?: string; name_en?: string }>
    $doc?: string
  }
  for (const asset of source.assets ?? []) asset.name_zh = asset.name_en ?? asset.name_zh
  stripCjk(source)
  source.$doc = 'English guest catalog. Chinese source notes are omitted from this build.'
  fs.mkdirSync(path.dirname(catalogDest), { recursive: true })
  fs.writeFileSync(catalogDest, JSON.stringify(source))
}

function guestCatalog(): Plugin {
  writeEnglishCatalog()
  return {
    name: 'guest-english-catalog',
    enforce: 'pre',
    config() {
      writeEnglishCatalog()
    },
    resolveId(source) {
      const normalized = source.replace(/\\/g, '/')
      if (normalized.endsWith('assets/characters/ASSETS.json')) return catalogDest
    },
  }
}

function guestCss(): Plugin {
  return {
    name: 'guest-css-cleanup',
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type !== 'asset' || !item.fileName.endsWith('.css') || typeof item.source !== 'string') continue
        item.source = item.source
          .replace(/PingFang SC/g, 'Segoe UI')
          .replace(/Microsoft YaHei/g, 'Segoe UI')
          .replace(/[^{}]*\.eb-champion-entry[^{]*\{[^}]*\}/g, '')
      }
    },
  }
}

function guestIndex(): Plugin {
  return {
    name: 'guest-index',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/' || req.url === '/index.html') req.url = '/index.guest.html'
        next()
      })
    },
    closeBundle() {
      const from = path.join(root, 'dist-guest/index.guest.html')
      const to = path.join(root, 'dist-guest/index.html')
      if (fs.existsSync(from)) fs.copyFileSync(from, to)
    },
  }
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react(), guestCatalog(), guestCss(), guestIndex()],
  resolve: {
    alias: { '@shared': path.join(root, 'src/shared') },
  },
  css: {
    preprocessorOptions: {
      less: { javascriptEnabled: true },
    },
  },
  build: {
    outDir: 'dist-guest',
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(root, 'index.guest.html'),
    },
  },
})
