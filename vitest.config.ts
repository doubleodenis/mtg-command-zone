import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const alias = { '@': path.resolve(__dirname, './src') }
const exclude = ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/.worktrees/**']

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/types/**',
        'src/app/**',
        'src/components/**',
      ],
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          include: ['src/**/*.{test,spec}.{ts,mts,cts}', 'scripts/**/*.{test,spec}.ts'],
          exclude: [...exclude, 'src/components/**'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'jsdom',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/components/**/*.{test,spec}.{tsx,ts}'],
          exclude,
        },
      },
    ],
  },
})
