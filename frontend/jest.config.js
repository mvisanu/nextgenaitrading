/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",

  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", {
      tsconfig: {
        jsx: "react-jsx",
        esModuleInterop: true,
        moduleResolution: "node",
        allowJs: true,
        strict: false,
      },
    }],
  },

  // Runs after the test environment is set up (adds jest-dom matchers, etc.)
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "\\.(css|less|scss|sass)$": "<rootDir>/__mocks__/styleMock.js",
    "\\.(jpg|jpeg|png|gif|svg|ico|webp)$": "<rootDir>/__mocks__/fileMock.js",
    "^lightweight-charts$": "<rootDir>/__mocks__/lightweight-charts.js",
    "^plotly\\.js-dist-min$": "<rootDir>/__mocks__/plotly.js",
    "^react-plotly\\.js$": "<rootDir>/__mocks__/react-plotly.js",
  },

  testMatch: [
    "<rootDir>/__tests__/**/*.test.(ts|tsx)",
    "<rootDir>/__tests__/**/*.spec.(ts|tsx)",
  ],

  collectCoverageFrom: [
    "lib/**/*.ts",
    "middleware.ts",
    "components/**/*.tsx",
    "app/**/*.tsx",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],

  transformIgnorePatterns: [
    "node_modules/(?!(sonner|@radix-ui|lucide-react|recharts)/)",
  ],

  testEnvironmentOptions: {
    url: "http://localhost:3000",
  },
};

module.exports = config;
