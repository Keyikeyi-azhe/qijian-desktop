import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/out',
      'src/renderer/public/games/**',
      'src/renderer/public/excalidraw/**'
    ]
  },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  eslintConfigPrettier,
  {
    files: ['scripts/game-adapters/**/*.js'],
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' }
  },
  {
    files: ['scripts/game-adapters/fruitbasket/fruit.js'],
    languageOptions: { globals: { Matter: 'readonly' } }
  },
  {
    files: ['scripts/game-adapters/host-bridge.js'],
    languageOptions: { globals: { zzfx_x: 'readonly', score: 'readonly', levelNumber: 'readonly' } }
  },
  {
    files: ['scripts/verify-desk-games.cjs', 'scripts/verify-improvements.cjs'],
    languageOptions: {
      globals: {
        player: 'readonly',
        gameState: 'writable',
        Matter: 'readonly',
        winTimer: 'readonly'
      }
    }
  },
  {
    files: ['scripts/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  }
)
