type PackageInfo = {
  name: string;
  version: string;
  currentVersion?: string;
  versionRange: string;
  isInstalled: boolean;
  hasUpdate?: boolean;
  updateType?: "major" | "minor" | "patch" | "prerelease";
  latestVersion?: string;
  availableVersions?: string[];
};
