import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const standalone = join(root, '.next', 'standalone')

if (!existsSync(join(standalone, 'server.js'))) {
  throw new Error('Standalone server was not produced. Check next.config.ts.')
}

const publicSource = join(root, 'public')
if (existsSync(publicSource)) {
  cpSync(publicSource, join(standalone, 'public'), { recursive: true, force: true })
}

const staticSource = join(root, '.next', 'static')
if (existsSync(staticSource)) {
  const staticTarget = join(standalone, '.next', 'static')
  mkdirSync(staticTarget, { recursive: true })
  cpSync(staticSource, staticTarget, { recursive: true, force: true })
}

console.log('Standalone deployment assets prepared.')
