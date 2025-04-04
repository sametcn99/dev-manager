import * as vscode from "vscode";

declare global {
  type ProjectInfo = {
    name: string;
    path: string;
    uri: vscode.Uri;
    dependencies: PackageInfo[];
    devDependencies: PackageInfo[];
    packageManager: PackageManager;
    scripts: Record<string, string>;
    updateSettings: UpdateNotificationSettings;
    license?: string; // The project's license
  };
}
