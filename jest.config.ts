import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  // jest-dom matchers (toBeInTheDocument, toHaveAttribute 等) を全テストで有効化
  setupFilesAfterEnv: ['<rootDir>/__tests__/helpers/jestDomSetup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // CSS Modules をモック
    '\\.module\\.css$': '<rootDir>/__tests__/helpers/cssModuleMock.js',
    // 通常の .css（globals.css 等）もモック
    '\\.css$': '<rootDir>/__tests__/helpers/cssModuleMock.js',
    // @xyflow/react をモック（サーバーサイド実行不可のブラウザ専用ライブラリ）
    '^@xyflow/react$': '<rootDir>/__tests__/helpers/xyflowMock.ts',
    // @vercel/analytics/next は ESM-only のためテスト環境でモック
    '^@vercel/analytics/next$': '<rootDir>/__tests__/helpers/vercelAnalyticsMock.ts',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        module: 'commonjs',
        moduleResolution: 'node',
        paths: {
          '@/*': ['<rootDir>/src/*'],
        },
        strict: false,
      },
    }],
  },
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
};

export default config;
