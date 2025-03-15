export default {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],
  transform: {},
  // extensionsToTreatAsEsm no longer needed as .js files are treated as ESM by default
  // when "type": "module" is set in package.json
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  transformIgnorePatterns: [
    "node_modules/(?!(@actions|openai)/)"
  ]
};
