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

type TaskType = "build" | "test" | "serve" | "lint" | "custom";

interface TaskConfig {
  name: string;
  type: TaskType;
  command: string;
  cwd?: string;
  description?: string;
  isBackground?: boolean;
  group?: {
    kind: string;
    isDefault?: boolean;
  };
}

interface DevManagerConfig {
  tasks?: TaskConfig[];
  // Add other config options here in the future
}
