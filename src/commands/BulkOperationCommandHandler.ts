import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";
import { PackageManagerService } from "../services/PackageManagerService";

export class BulkOperationCommandHandler {
  constructor(
    private projectTreeProvider: ProjectTreeProvider,
    private packageManagerService: PackageManagerService,
  ) {}

  public registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dev-manager.installAllDependencies",
        this.handleInstallAllDependencies.bind(this),
      ),
      vscode.commands.registerCommand(
        "dev-manager.updateAllDependencies",
        this.handleUpdateAllDependencies.bind(this),
      ),
    );
  }

  private async handleInstallAllDependencies() {
    const projects = await this.projectTreeProvider.getAllProjects();
    if (projects.length === 0) {
      vscode.window.showInformationMessage(
        "No Node.js projects found in workspace",
      );
      return;
    }

    for (const project of projects) {
      const terminal = vscode.window.createTerminal(
        `Install - ${project.name}`,
      );
      terminal.show();
      const installCmd = this.packageManagerService.getCommand(
        project.packageManager,
        "install",
      );
      terminal.sendText(
        `cd "${project.path}" && echo "Installing dependencies for ${project.name}..." && ${installCmd}`,
      );
    }
    vscode.window.showInformationMessage(
      `Installing dependencies for ${projects.length} projects in separate terminals...`,
    );
  }

  private async handleUpdateAllDependencies() {
    const projects = await this.projectTreeProvider.getAllProjects();
    if (projects.length === 0) {
      vscode.window.showInformationMessage(
        "No Node.js projects found in workspace",
      );
      return;
    }

    // Check which projects have updates according to their notification settings
    const projectsWithUpdates = projects.filter((project) =>
      [...project.dependencies, ...project.devDependencies].some(
        (dep) => dep.hasUpdate,
      ),
    );

    if (projectsWithUpdates.length === 0) {
      vscode.window.showInformationMessage(
        "No updates available according to current notification settings",
      );
      return;
    }

    for (const project of projectsWithUpdates) {
      const terminal = vscode.window.createTerminal(`Update - ${project.name}`);
      terminal.show();
      const updateCmd = this.packageManagerService.getCommand(
        project.packageManager,
        "update",
      );
      terminal.sendText(
        `cd "${project.path}" && echo "Updating dependencies for ${project.name} (${project.updateSettings.notificationLevel} updates)..." && ${updateCmd}`,
      );
    }
    vscode.window.showInformationMessage(
      `Updating dependencies for ${projectsWithUpdates.length} projects in separate terminals...`,
    );
  }
}
