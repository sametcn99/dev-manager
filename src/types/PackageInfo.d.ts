type PackageInfo = {
  name: string;
  version: string;
  currentVersion?: string;
  versionRange: string;
  isInstalled: boolean;
  hasUpdate?: boolean;
  latestVersion?: string;
  availableVersions?: string[];
};
