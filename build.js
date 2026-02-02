// build.mjs
import { build } from 'esbuild';
import { promises as fs } from 'fs';
import { createRequire } from 'module';

// Read package.json to get dependencies
const require = createRequire(import.meta.url);
const pkg = require('./package.json');

// Auto-externalize all dependencies
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {})
];

const sharedConfig = {
  entryPoints: ['index.js'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  minify: false,
  external, // Auto-externalized!
};

async function buildAll() {
  try {
    await fs.mkdir('dist', { recursive: true });

    console.log(`Externalizing: ${external.join(', ')}`);
    console.log('');

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

    await fs.writeFile(
      'dist/package.json',
      JSON.stringify({ type: 'module' }, null, 2)
    );
    console.log('✓ Created dist/package.json');

    console.log('\n✨ Build successful!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

buildAll();
