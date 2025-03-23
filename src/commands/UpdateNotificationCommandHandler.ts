import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";

export class UpdateNotificationCommandHandler {
  constructor(private projectTreeProvider: ProjectTreeProvider) {}

  public registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dev-manager.changeUpdateNotificationSettings",
        this.handleChangeUpdateNotificationSettings.bind(this),
      ),
    );
  }

  private async handleChangeUpdateNotificationSettings(info: {
    path: string;
    currentSetting: UpdateNotificationType;
  }): Promise<void> {
    // Define available options
    const options: vscode.QuickPickItem[] = [
      {
        label: "major",
        description: "Only show warnings for major version updates",
        detail: "Example: Notify for 2.0.0 when current is 1.x.x",
      },
      {
        label: "minor",
        description:
          "Show warnings for major and minor version updates (default)",
        detail: "Example: Notify for 1.1.0 or 2.0.0 when current is 1.0.x",
      },
      {
        label: "patch",
        description: "Show warnings for all standard version updates",
        detail:
          "Example: Notify for 1.0.1, 1.1.0 or 2.0.0 when current is 1.0.0",
      },
      {
        label: "prerelease",
        description: "Show warnings for all updates including prereleases",
        detail: "Example: Notify for all updates including alpha/beta versions",
      },
      {
        label: "all",
        description: "Show warnings for all types of updates",
        detail: "Same behavior as prerelease",
      },
      {
        label: "none",
        description: "Don't show any update warnings",
        detail: "Hide all dependency update indicators",
      },
    ];

    // Show picker with options, properly setting the currently selected item
    const selectedOption = await vscode.window.showQuickPick(options, {
      title: "Select Update Notification Level",
      placeHolder: `Current setting: ${info.currentSetting}`,
      // VS Code will automatically highlight the item matching the current setting
    });

    if (selectedOption) {
      await this.projectTreeProvider.changeUpdateNotificationSettings({
        path: info.path,
        notificationLevel: selectedOption.label as UpdateNotificationType,
      });

      // Force a full refresh by triggering workspace rescan
      this.projectTreeProvider.refresh();

      vscode.window.showInformationMessage(
        `Update notification level changed to: ${selectedOption.label}`,
      );
    }
  }
}
