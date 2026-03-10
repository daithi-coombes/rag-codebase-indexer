import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    files: ['**/*.js'],
    rules: {
      'preserve-caught-error': 'off'
    },
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node }
  },
  {
    ignores: ['architecture/**', './coverage/**', 'dist/**']
  }
]);
