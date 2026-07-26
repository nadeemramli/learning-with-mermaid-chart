import manifest from '../../content/manifest.json'
import { buildUniverse, type Universe } from './universe'

const globbed = import.meta.glob('../../content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Re-key glob paths ("../../content/accounting/x.md") to manifest-relative paths ("accounting/x.md").
const filesByPath: Record<string, string> = {}
for (const [path, raw] of Object.entries(globbed)) {
  filesByPath[path.replace(/^.*?\/content\//, '')] = raw
}

/** The universe is static content — parse and validate once at module init. */
export const universe: Universe = buildUniverse(manifest, filesByPath)
