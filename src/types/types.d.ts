import * as vscode from "vscode";

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

  type CustomTaskDefinition = {
    label?: string;
    command?: string;
    type: string;
    isBackground?: boolean;
    problemMatcher?: string[];
    group?: {
      kind?: "build" | "test";
      isDefault?: boolean;
    };
    detail?: string;
    presentation?: {
      echo?: boolean;
      reveal?: "always" | "silent" | "never";
      focus?: boolean;
      panel?: "shared" | "dedicated" | "new";
      showReuseMessage?: boolean;
      clear?: boolean;
    };
    options?: {
      cwd?: string;
      env?: { [key: string]: string };
      shell?: {
        executable?: string;
        args?: string[];
      };
    };
    runOptions?: {
      reevaluateOnRerun?: boolean;
    };
    dependsOn?: Array<string | { type: string; task: string }>;
    dependsOrder?: "parallel" | "sequence";
  } & vscode.TaskDefinition;
}
