import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";
import { PackageManagerService } from "../services/PackageManagerService";
import { TaskService } from "../services/TaskService";
import { DependencyCommandHandler } from "./DependencyCommandHandler";
import { LicenseCommandHandler } from "./LicenseCommandHandler";
import { PackageManagerCommandHandler } from "./PackageManagerCommandHandler";
import { PackageSizeCommandHandler } from "./PackageSizeCommandHandler";
import { ProjectCommandHandler } from "./ProjectCommandHandler";
import { ScriptCommandHandler } from "./ScriptCommandHandler";
import { TaskCommandHandler } from "./TaskCommandHandler";
import { UpdateNotificationCommandHandler } from "./UpdateNotificationCommandHandler";

export class CommandHandlers {
  private projectCommandHandler: ProjectCommandHandler;
  private packageManagerCommandHandler: PackageManagerCommandHandler;
  private dependencyCommandHandler: DependencyCommandHandler;
  private scriptCommandHandler: ScriptCommandHandler;
  private updateNotificationCommandHandler: UpdateNotificationCommandHandler;
  private licenseCommandHandler: LicenseCommandHandler;
  private packageSizeCommandHandler: PackageSizeCommandHandler;
  private taskCommandHandler: TaskCommandHandler;

  constructor(
    private projectTreeProvider: ProjectTreeProvider,
    private packageManagerService: PackageManagerService,
    private taskService: TaskService,
    private context: vscode.ExtensionContext,
  ) {
    this.projectCommandHandler = new ProjectCommandHandler(projectTreeProvider);
    this.packageManagerCommandHandler = new PackageManagerCommandHandler(
      projectTreeProvider,
      packageManagerService,
    );
    this.dependencyCommandHandler = new DependencyCommandHandler(
      projectTreeProvider,
      packageManagerService,
    );
    this.scriptCommandHandler = new ScriptCommandHandler(projectTreeProvider);
    this.updateNotificationCommandHandler =
      new UpdateNotificationCommandHandler(projectTreeProvider);
    this.licenseCommandHandler = new LicenseCommandHandler(projectTreeProvider);
    this.packageSizeCommandHandler = new PackageSizeCommandHandler(
      projectTreeProvider,
      context,
    );
    this.taskCommandHandler = new TaskCommandHandler(context);
  }

  public registerCommands(context: vscode.ExtensionContext): void {
    this.projectCommandHandler.registerCommands(context);
    this.packageManagerCommandHandler.registerCommands(context);
    this.dependencyCommandHandler.registerCommands(context);
    this.scriptCommandHandler.registerCommands(context);
    this.updateNotificationCommandHandler.registerCommands(context);
    this.licenseCommandHandler.registerCommands(context);
    this.packageSizeCommandHandler.registerCommands(context);
    this.taskCommandHandler.registerCommands(context);
  }
}
