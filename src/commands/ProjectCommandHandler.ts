import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";

export class ProjectCommandHandler {
  constructor(private projectTreeProvider: ProjectTreeProvider) {}

  public registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dev-manager.refreshProjects",
        async () => {
          this.projectTreeProvider.refresh();
        },
      ),
    );
  }
}
