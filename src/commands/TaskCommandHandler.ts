import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";
import { TaskService } from "../services/TaskService";

export class TaskCommandHandler {
  constructor(
    private projectTreeProvider: ProjectTreeProvider,
    private taskService: TaskService,
  ) {}

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

  private async handleCreateTask(): Promise<void> {
    const taskName = await vscode.window.showInputBox({
      title: "Task Name",
      placeHolder: "Enter task name...",
      validateInput: (value) => {
        return value ? null : "Task name is required";
      },
    });

    if (!taskName) {
      return;
    }

    const taskType = await vscode.window.showQuickPick(
      [
        { label: "build", description: "Build task" },
        { label: "test", description: "Test task" },
        { label: "serve", description: "Serve task" },
        { label: "lint", description: "Lint task" },
        { label: "custom", description: "Custom task" },
      ],
      {
        title: "Task Type",
        placeHolder: "Select task type...",
      },
    );

    if (!taskType) {
      return;
    }

    const command = await vscode.window.showInputBox({
      title: "Task Command",
      placeHolder: "Enter command to run...",
      validateInput: (value) => {
        return value ? null : "Command is required";
      },
    });

    if (!command) {
      return;
    }

    const description = await vscode.window.showInputBox({
      title: "Task Description (Optional)",
      placeHolder: "Enter task description...",
    });

    const isBackground = await vscode.window.showQuickPick(
      [
        { label: "No", description: "Run in foreground" },
        { label: "Yes", description: "Run in background" },
      ],
      {
        title: "Background Task?",
        placeHolder: "Should this task run in the background?",
      },
    );

    if (!isBackground) {
      return;
    }

    const task: TaskConfig = {
      name: taskName,
      type: taskType.label as TaskType,
      command,
      description,
      isBackground: isBackground.label === "Yes",
    };

    await this.taskService.addTask(task);
    this.projectTreeProvider.refresh();
  }

  private async handleEditTask(task: TaskConfig): Promise<void> {
    const taskName = await vscode.window.showInputBox({
      title: "Task Name",
      value: task.name,
      placeHolder: "Enter task name...",
      validateInput: (value) => {
        return value ? null : "Task name is required";
      },
    });

    if (!taskName) {
      return;
    }

    const taskTypeItems: { label: TaskType; description: string }[] = [
      { label: "build", description: "Build task" },
      { label: "test", description: "Test task" },
      { label: "serve", description: "Serve task" },
      { label: "lint", description: "Lint task" },
      { label: "custom", description: "Custom task" },
    ];

    const taskType = await vscode.window.showQuickPick(taskTypeItems, {
      title: "Task Type",
      placeHolder: "Select task type...",
    });

    if (!taskType) {
      return;
    }

    const command = await vscode.window.showInputBox({
      title: "Task Command",
      value: task.command,
      placeHolder: "Enter command to run...",
      validateInput: (value) => {
        return value ? null : "Command is required";
      },
    });

    if (!command) {
      return;
    }

    const description = await vscode.window.showInputBox({
      title: "Task Description (Optional)",
      value: task.description,
      placeHolder: "Enter task description...",
    });

    const isBackground = await vscode.window.showQuickPick(
      [
        { label: "No", description: "Run in foreground" },
        { label: "Yes", description: "Run in background" },
      ],
      {
        title: "Background Task?",
        placeHolder: "Should this task run in the background?",
      },
    );

    if (!isBackground) {
      return;
    }

    const updatedTask: TaskConfig = {
      name: taskName,
      type: taskType.label,
      command,
      description,
      isBackground: isBackground.label === "Yes",
    };

    await this.taskService.updateTask(task.name, updatedTask);
    this.projectTreeProvider.refresh();
  }

  private async handleDeleteTask(task: TaskConfig): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to delete task '${task.name}'?`,
      { modal: true },
      "Yes",
      "No",
    );

    if (confirm === "Yes") {
      await this.taskService.deleteTask(task.name);
      this.projectTreeProvider.refresh();
    }
  }

  private async handleRunTask(task: TaskConfig): Promise<void> {
    await this.taskService.runTask(task);
  }
}
