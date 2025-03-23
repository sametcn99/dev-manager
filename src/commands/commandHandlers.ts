import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";
import { PackageManagerService } from "../services/PackageManagerService";
import { ProjectCommandHandler } from "./ProjectCommandHandler";
import { PackageManagerCommandHandler } from "./PackageManagerCommandHandler";
import { DependencyCommandHandler } from "./DependencyCommandHandler";
import { BulkOperationCommandHandler } from "./BulkOperationCommandHandler";
import { ScriptCommandHandler } from "./ScriptCommandHandler";

export class CommandHandlers {
  private projectCommandHandler: ProjectCommandHandler;
  private packageManagerCommandHandler: PackageManagerCommandHandler;
  private dependencyCommandHandler: DependencyCommandHandler;
  private bulkOperationCommandHandler: BulkOperationCommandHandler;
  private scriptCommandHandler: ScriptCommandHandler;

  constructor(
    private projectTreeProvider: ProjectTreeProvider,
    private packageManagerService: PackageManagerService,
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
    this.bulkOperationCommandHandler = new BulkOperationCommandHandler(
      projectTreeProvider,
      packageManagerService,
    );
    this.scriptCommandHandler = new ScriptCommandHandler(projectTreeProvider);
  }

  public registerCommands(context: vscode.ExtensionContext): void {
    this.projectCommandHandler.registerCommands(context);
    this.packageManagerCommandHandler.registerCommands(context);
    this.dependencyCommandHandler.registerCommands(context);
    this.bulkOperationCommandHandler.registerCommands(context);
    this.scriptCommandHandler.registerCommands(context);
  }
}
