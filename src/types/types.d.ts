declare global {
  type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

  type UpdateNotificationType =
    | "major"
    | "minor"
    | "patch"
    | "prerelease"
    | "all"
    | "none";

  type UpdateNotificationSettings = {
    notificationLevel: UpdateNotificationType;
  };
}

export {};
