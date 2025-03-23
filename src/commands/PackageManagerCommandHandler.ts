import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";
import { PackageManagerService } from "../services/PackageManagerService";

export class PackageManagerCommandHandler {
  constructor(
    private projectTreeProvider: ProjectTreeProvider,
    private packageManagerService: PackageManagerService,
  ) {}

  public registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dev-manager.showPackageManagerPicker",
        this.handleShowPackageManagerPicker.bind(this),
      ),
      vscode.commands.registerCommand(
        "dev-manager.changePackageManager",
        this.handleChangePackageManager.bind(this),
      ),
    );
  }

  private async handleShowPackageManagerPicker(info: {
    path: string;
    current: PackageManager;
    available: PackageManager[];
  }) {
    const items = info.available.map((pm) => ({
      label: pm,
      description: pm === info.current ? "Current" : undefined,
      picked: pm === info.current,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      title: "Select Package Manager",
      placeHolder: `Current: ${info.current}`,
    });

    if (selected && selected.label !== info.current) {
      await vscode.commands.executeCommand("dev-manager.changePackageManager", {
        path: info.path,
        packageManager: selected.label as PackageManager,
      });
    }
  }

  private async handleChangePackageManager(info: {
    path: string;
    packageManager: PackageManager;
  }) {
    const projectUri = vscode.Uri.file(info.path);
    const currentLockFile =
      await this.packageManagerService.getLockFile(projectUri);

    const message = currentLockFile
      ? `This will delete node_modules and ${currentLockFile}. Are you sure you want to switch to ${info.packageManager}?`
      : `This will delete node_modules. Are you sure you want to switch to ${info.packageManager}?`;

    const response = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      "Yes",
      "No",
    );

    if (response !== "Yes") {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Switching to ${info.packageManager}...`,
        cancellable: false,
      },
      async (progress) => {
        try {
          progress.report({ message: "Cleaning up..." });
          await this.packageManagerService.cleanupBeforePackageManagerChange(
            projectUri,
          );

          await this.projectTreeProvider.changePackageManager(info);

          progress.report({ message: "Installing dependencies..." });
          const terminal = vscode.window.createTerminal(
            `Dev Manager - ${info.packageManager} Install`,
          );
          terminal.show();
          const installCmd = this.packageManagerService.getCommand(
            info.packageManager,
            "install",
          );
          terminal.sendText(`cd "${info.path}" && ${installCmd}`);

          vscode.window.showInformationMessage(
            `Successfully switched to ${info.packageManager}`,
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to switch package manager: ${error}`,
          );
        }
      },
    );
  }
}
