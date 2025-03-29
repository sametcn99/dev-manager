import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";
import { TasksTreeProvider } from "../providers/TasksTreeProvider";
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
  private scriptCommandHandler: ScriptCommandHandler;
  private dependencyCommandHandler: DependencyCommandHandler;
  private packageSizeCommandHandler: PackageSizeCommandHandler;
  private taskCommandHandler: TaskCommandHandler;
  private licenseCommandHandler: LicenseCommandHandler;
  private updateNotificationCommandHandler: UpdateNotificationCommandHandler;

  constructor(
    context: vscode.ExtensionContext,
    private projectTreeProvider: ProjectTreeProvider,
  ) {
    // Initialize services
    const taskService = new TaskService();
    const tasksTreeProvider = new TasksTreeProvider(taskService);
    const packageManagerService = new PackageManagerService();

    this.projectCommandHandler = new ProjectCommandHandler(projectTreeProvider);
    this.packageManagerCommandHandler = new PackageManagerCommandHandler(
      projectTreeProvider,
      packageManagerService,
    );
    this.scriptCommandHandler = new ScriptCommandHandler(projectTreeProvider);
    this.dependencyCommandHandler = new DependencyCommandHandler(
      projectTreeProvider,
      packageManagerService,
    );
    this.packageSizeCommandHandler = new PackageSizeCommandHandler(
      projectTreeProvider,
      context,
    );
    this.taskCommandHandler = new TaskCommandHandler(
      context,
      tasksTreeProvider,
    );
    this.licenseCommandHandler = new LicenseCommandHandler(projectTreeProvider);
    this.updateNotificationCommandHandler =
      new UpdateNotificationCommandHandler(projectTreeProvider);
  }

  public registerAll(context: vscode.ExtensionContext): void {
    this.projectCommandHandler.registerCommands(context);
    this.packageManagerCommandHandler.registerCommands(context);
    this.scriptCommandHandler.registerCommands(context);
    this.dependencyCommandHandler.registerCommands(context);
    this.packageSizeCommandHandler.registerCommands(context);
    this.taskCommandHandler.registerCommands(context);
    this.licenseCommandHandler.registerCommands(context);
    this.updateNotificationCommandHandler.registerCommands(context);
  }
}
