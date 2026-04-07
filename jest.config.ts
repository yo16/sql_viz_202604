import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // CSS Modules をモック
    '\\.module\\.css$': '<rootDir>/__tests__/helpers/cssModuleMock.js',
    // @xyflow/react をモック（サーバーサイド実行不可のブラウザ専用ライブラリ）
    '^@xyflow/react$': '<rootDir>/__tests__/helpers/xyflowMock.ts',
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
