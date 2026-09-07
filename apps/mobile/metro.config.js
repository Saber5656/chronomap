const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");
const sharedSourceRoot = path.resolve(monorepoRoot, "src");
const config = getDefaultConfig(projectRoot);
const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList].filter(Boolean);

config.watchFolders = [...new Set([...config.watchFolders, sharedSourceRoot])];
config.resolver.blockList = [...defaultBlockList, /(?:^|[/\\])\.env(?:\..*)?$/];

module.exports = config;
