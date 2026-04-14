import { build } from 'esbuild';
import { promises as fs } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {})
];

const sharedConfig = {
  entryPoints: ['index.js'],
  bundle: true,
  platform: 'node',
  target: 'node20',        // ← changed from node22
  sourcemap: true,
  minify: false,
  external,
};

async function buildAll() {
  try {
    await fs.mkdir('dist', { recursive: true });

    console.log(`Externalizing: ${external.join(', ')}\n`);

    console.log('Building ESM...');
    await build({
      ...sharedConfig,
      format: 'esm',
      outfile: 'dist/index.mjs',
    });
    console.log('✓ ESM build complete');

    console.log('Building CJS...');
    await build({
      ...sharedConfig,
      format: 'cjs',
      outfile: 'dist/index.cjs',
    });
    console.log('✓ CJS build complete');

    // Removed dist/package.json creation

    console.log('\n✨ Build successful!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

buildAll();
