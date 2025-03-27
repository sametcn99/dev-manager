import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";
import { TaskService } from "../services/TaskService";
import { TaskWebView } from "../views/TaskWebView";

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

    // Check if this is a workspace task (defined in tasks.json)
    const wsConfig = vscode.workspace.getConfiguration("tasks", scope.uri);
    const workspaceTasks = wsConfig.get("tasks", []) as CustomTaskDefinition[];
    const isWorkspaceTask = workspaceTasks.some(
      (t) => t.label === task.definition.label,
    );

    if (!isWorkspaceTask) {
      vscode.window.showErrorMessage(
        "Only workspace tasks (defined in tasks.json) can be edited",
      );
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

    // Check if this is a workspace task (defined in tasks.json)
    const wsConfig = vscode.workspace.getConfiguration("tasks", task.scope.uri);
    const workspaceTasks = wsConfig.get("tasks", []) as CustomTaskDefinition[];
    const isWorkspaceTask = workspaceTasks.some((t) => t.label === task.name);

    if (!isWorkspaceTask) {
      vscode.window.showErrorMessage(
        "Only workspace tasks (defined in tasks.json) can be deleted",
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
          // Get all tasks first - we'll need them regardless of lookup method
          const tasks = await this.taskService.getTasks();
          if (tasks.length === 0) {
            vscode.window.showErrorMessage("No tasks available in workspace");
            return;
          }

          // Normalize task ID by removing leading slash and handling numeric IDs
          let normalizedTaskId = info.taskId;
          if (normalizedTaskId.startsWith("/")) {
            normalizedTaskId = normalizedTaskId.substring(1);
          }

          let taskToRun: vscode.Task | undefined;

          // Try to find task by numeric index first
          if (/^\d+$/.test(normalizedTaskId)) {
            const taskIndex = parseInt(normalizedTaskId, 10);

            if (taskIndex > 0 && taskIndex <= tasks.length) {
              // Tasks are 1-indexed in the UI
              taskToRun = tasks[taskIndex - 1];
            } else {
              vscode.window.showErrorMessage(
                `Task index ${taskIndex} is out of range. There are ${tasks.length} tasks available.`,
              );
              return;
            }
          } else {
            // Try to find task by label first (which is what's shown in the UI)
            taskToRun = tasks.find((task) => {
              // Check if the task has a definition with a label property
              return (
                task.definition &&
                "label" in task.definition &&
                task.definition.label === normalizedTaskId
              );
            });

            // If not found by label, fall back to name
            if (!taskToRun) {
              taskToRun = tasks.find((task) => task.name === normalizedTaskId);
            }
          }

          // Execute the task if found
          if (taskToRun) {
            await vscode.tasks.executeTask(taskToRun);
          } else {
            // Provide a more helpful error message with available tasks
            const availableTasks = tasks
              .map((t, index) => {
                const label =
                  t.definition && "label" in t.definition
                    ? t.definition.label
                    : t.name;
                return `${index + 1}: ${label} (${t.name})`;
              })
              .join("\n");

            vscode.window.showErrorMessage(
              `Task "${normalizedTaskId}" not found. Available tasks:\n${availableTasks}`,
              { modal: true },
            );
          }
        },
      );
    } catch (error) {
      console.error("Task execution error:", error);
      vscode.window.showErrorMessage(
        `Failed to run task: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
