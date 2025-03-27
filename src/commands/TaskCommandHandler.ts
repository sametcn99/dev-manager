import * as vscode from "vscode";
import { TaskService } from "../services/TaskService";
import { TaskWebView } from "../views/TaskWebView";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";

export class TaskCommandHandler {
  private taskService: TaskService;
  private projectTreeProvider: ProjectTreeProvider;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.taskService = new TaskService();
    this.projectTreeProvider = new ProjectTreeProvider(this.taskService);
  }

  public registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dev-manager.createTask",
        this.handleCreateTask.bind(this),
      ),
      vscode.commands.registerCommand(
        "dev-manager.editTask",
        this.handleEditTask.bind(this),
      ),
      vscode.commands.registerCommand(
        "dev-manager.deleteTask",
        this.handleDeleteTask.bind(this),
      ),
      vscode.commands.registerCommand(
        "dev-manager.runTask",
        this.handleRunTask.bind(this),
      ),
    );
  }

  private async handleCreateTask(workspaceFolder?: vscode.WorkspaceFolder) {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Opening task editor...",
        cancellable: false,
      },
      async () => {
        const projects = await this.projectTreeProvider.getAllProjects();
        const projectPaths = projects.map((p) => p.path);
        new TaskWebView(
          this.context.extensionUri,
          this.taskService,
          undefined,
          workspaceFolder,
          projectPaths,
        );
      },
    );
  }

  private async handleEditTask(task: vscode.Task) {
    if (!task.definition) {
      vscode.window.showErrorMessage(
        "Cannot edit this task: missing task definition",
      );
      return;
    }

    const scope = task.scope;
    if (!scope || typeof scope === "number") {
      vscode.window.showErrorMessage("Cannot edit this task: invalid scope");
      return;
    }

    const projects = await this.projectTreeProvider.getAllProjects();
    const projectPaths = projects.map((p) => p.path);
    new TaskWebView(
      this.context.extensionUri,
      this.taskService,
      task.definition,
      scope,
      projectPaths,
    );
  }

  private async handleDeleteTask(task: vscode.Task) {
    if (!task.name || !task.scope || typeof task.scope === "number") {
      vscode.window.showErrorMessage(
        "Cannot delete this task: invalid task configuration",
      );
      return;
    }

    const answer = await vscode.window.showWarningMessage(
      `Are you sure you want to delete task "${task.name}"?`,
      { modal: true },
      "Yes",
      "No",
    );

    if (answer === "Yes") {
      try {
        await this.taskService.deleteTask(task.name, task.scope);
        vscode.window.showInformationMessage(
          `Task "${task.name}" deleted successfully`,
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete task: ${error}`);
      }
    }
  }

  private async handleRunTask(info: { taskId: string }) {
    if (!info?.taskId) {
      vscode.window.showErrorMessage("No task ID provided");
      return;
    }

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Loading task...",
          cancellable: false,
        },
        async () => {
          // Remove leading slash if present
          const normalizedTaskId = info.taskId.startsWith("/")
            ? info.taskId.substring(1)
            : info.taskId;

          const tasks = await this.taskService.getTasks();
          const taskToRun = tasks.find(
            (task) => task.name === normalizedTaskId,
          );

          if (taskToRun) {
            await vscode.tasks.executeTask(taskToRun);
          } else {
            vscode.window.showErrorMessage(
              `Task "${normalizedTaskId}" not found. Available tasks: ${tasks
                .map((t) => t.name)
                .join(", ")}`,
            );
          }
        },
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to run task: ${error}`);
    }
  }
}
