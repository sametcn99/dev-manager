import * as vscode from "vscode";

type ProjectInfo = {
  name: string;
  path: string;
  uri: vscode.Uri;
  dependencies: PackageInfo[];
  devDependencies: PackageInfo[];
  packageManager: PackageManager;
};
