import * as vscode from "vscode";

export class TaskService {
  async getTasks(): Promise<vscode.Task[]> {
    try {
      // First get all workspace tasks from VS Code's task provider
      const workspaceTasks = await vscode.tasks.fetchTasks();

      // Then get custom tasks from each workspace folder's tasks.json
      const workspaceFolders = vscode.workspace.workspaceFolders || [];
      const customTasks: vscode.Task[] = [];

      for (const folder of workspaceFolders) {
        const config = vscode.workspace.getConfiguration("tasks", folder.uri);
        const taskDefinitions = config.get(
          "tasks",
          [],
        ) as vscode.TaskDefinition[];

        for (const taskDef of taskDefinitions) {
          try {
            const task = new vscode.Task(
              taskDef,
              folder,
              taskDef.label || "unnamed",
              taskDef.type,
            );

            if (taskDef.command) {
              const shellOptions: vscode.ShellExecutionOptions = {};
              if (taskDef.options?.cwd) {
                shellOptions.cwd = taskDef.options.cwd;
              }
              if (taskDef.options?.env) {
                shellOptions.env = taskDef.options.env;
              }
              if (taskDef.options?.shell) {
                shellOptions.executable = taskDef.options.shell.executable;
                shellOptions.shellArgs = taskDef.options.shell.args;
              }
              task.execution = new vscode.ShellExecution(
                taskDef.command,
                shellOptions,
              );
            }

            customTasks.push(task);
          } catch (err) {
            console.error(`Failed to create task from definition: ${err}`);
          }
        }
      }

      // Combine all tasks and remove duplicates
      const allTasks = [...workspaceTasks, ...customTasks];
      return Array.from(
        new Map(allTasks.map((task) => [task.name, task])).values(),
      );
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return [];
    }
  }

  async createTask(
    taskConfig: vscode.TaskDefinition,
    workspaceFolder?: vscode.WorkspaceFolder,
  ): Promise<vscode.Task> {
    // Get workspace folder if not provided
    if (!workspaceFolder) {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        throw new Error("No workspace folder found for task creation");
      }
      workspaceFolder = folders[0];
    }

    // Ensure we have a valid URI
    if (!workspaceFolder.uri) {
      throw new Error("Invalid workspace folder: missing URI");
    }

    // First check if task with same label already exists
    const wsConfig = vscode.workspace.getConfiguration(
      "tasks",
      workspaceFolder.uri,
    );
    const existingTasks = wsConfig.get("tasks", []) as vscode.TaskDefinition[];
    if (existingTasks.some((task) => task.label === taskConfig.label)) {
      throw new Error(`Task with label "${taskConfig.label}" already exists`);
    }

    const newTask = new vscode.Task(
      taskConfig,
      workspaceFolder,
      taskConfig.label || "New Task",
      taskConfig.type,
    );

    // Configure execution
    if ("command" in taskConfig && taskConfig.command) {
      const shellOptions: vscode.ShellExecutionOptions = {};

      if (taskConfig.options?.cwd) {
        shellOptions.cwd = taskConfig.options.cwd;
      }
      if (taskConfig.options?.env) {
        shellOptions.env = taskConfig.options.env;
      }
      if (taskConfig.options?.shell) {
        shellOptions.executable = taskConfig.options.shell.executable;
        shellOptions.shellArgs = taskConfig.options.shell.args;
      }

      newTask.execution = new vscode.ShellExecution(
        taskConfig.command,
        shellOptions,
      );
    }

    // Configure background status
    if (taskConfig.isBackground) {
      newTask.isBackground = true;
    }

    // Configure problem matchers
    if (taskConfig.problemMatcher) {
      newTask.problemMatchers = taskConfig.problemMatcher;
    }

    // Configure group
    if (taskConfig.group) {
      if (taskConfig.group.kind === "build") {
        newTask.group = taskConfig.group.isDefault
          ? vscode.TaskGroup.Build
          : vscode.TaskGroup.Build;
      } else if (taskConfig.group.kind === "test") {
        newTask.group = taskConfig.group.isDefault
          ? vscode.TaskGroup.Test
          : vscode.TaskGroup.Test;
      }
    }

    // Configure presentation
    if (taskConfig.presentation) {
      newTask.presentationOptions = {
        echo: taskConfig.presentation.echo,
        reveal: this.getPresentationReveal(taskConfig.presentation.reveal),
        focus: taskConfig.presentation.focus,
        panel: this.getPresentationPanel(taskConfig.presentation.panel),
        showReuseMessage: taskConfig.presentation.showReuseMessage,
        clear: taskConfig.presentation.clear,
      };
    }

    // Configure run options
    if (taskConfig.runOptions) {
      newTask.runOptions = {
        reevaluateOnRerun: taskConfig.runOptions.reevaluateOnRerun,
      };
    }

    try {
      // Add the task to workspace folder configuration
      existingTasks.push(taskConfig);
      await wsConfig.update(
        "tasks",
        existingTasks,
        vscode.ConfigurationTarget.WorkspaceFolder,
      );
    } catch (error) {
      console.error("Failed to save task configuration:", error);
      throw new Error(
        `Could not save task configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return newTask;
  }

  private getPresentationReveal(
    reveal?: "always" | "silent" | "never",
  ): vscode.TaskRevealKind {
    switch (reveal) {
      case "always":
        return vscode.TaskRevealKind.Always;
      case "silent":
        return vscode.TaskRevealKind.Silent;
      case "never":
        return vscode.TaskRevealKind.Never;
      default:
        return vscode.TaskRevealKind.Always;
    }
  }

  private getPresentationPanel(
    panel?: "shared" | "dedicated" | "new",
  ): vscode.TaskPanelKind {
    switch (panel) {
      case "shared":
        return vscode.TaskPanelKind.Shared;
      case "dedicated":
        return vscode.TaskPanelKind.Dedicated;
      case "new":
        return vscode.TaskPanelKind.New;
      default:
        return vscode.TaskPanelKind.Shared;
    }
  }

  async deleteTask(task: vscode.TaskDefinition): Promise<void> {
    // Find which workspace folder contains this task
    const workspaceFolders = vscode.workspace.workspaceFolders || [];

    for (const folder of workspaceFolders) {
      const wsConfig = vscode.workspace.getConfiguration("tasks", folder.uri);
      const tasks = wsConfig.get("tasks", []) as vscode.TaskDefinition[];

      // Check if this folder contains the task we want to delete
      const taskExists = tasks.some((t) => t.label === task.label);

      if (taskExists) {
        const updatedTasks = tasks.filter((t) => t.label !== task.label);
        await wsConfig.update(
          "tasks",
          updatedTasks,
          vscode.ConfigurationTarget.WorkspaceFolder,
        );
        return; // Task found and deleted, exit the function
      }
    }

    // If we get here, the task wasn't found in any workspace folder
    throw new Error(`Task "${task.label}" not found in any workspace folder`);
  }

  async editTask(
    taskId: string,
    newConfig: vscode.TaskDefinition,
    scope: vscode.WorkspaceFolder,
  ): Promise<void> {
    const wsConfig = vscode.workspace.getConfiguration("tasks", scope.uri);
    const tasks = wsConfig.get("tasks", []) as vscode.TaskDefinition[];

    // First try to find the task by label
    let taskIndex = tasks.findIndex((task) => task.label === taskId);

    // If not found, try to find by task name (some tasks might be referenced by name)
    if (taskIndex === -1) {
      taskIndex = tasks.findIndex((task) => task.name === taskId);
    }

    if (taskIndex !== -1) {
      // Preserve fields that might be missing in the new config but present in the original
      tasks[taskIndex] = {
        ...tasks[taskIndex],
        ...newConfig,
      } as vscode.TaskDefinition;

      await wsConfig.update(
        "tasks",
        tasks,
        vscode.ConfigurationTarget.WorkspaceFolder,
      );
    } else {
      console.warn(
        `Task "${taskId}" not found in tasks.json, it may be auto-generated`,
      );

      // For auto-generated tasks, we need to create a new task entry
      if (newConfig.label) {
        // Check if another task with the same label already exists
        if (
          tasks.some((t) => t.label === newConfig.label && t.label !== taskId)
        ) {
          throw new Error(
            `Task with label "${newConfig.label}" already exists`,
          );
        }

        // Add the task as a new definition
        tasks.push(newConfig);
        await wsConfig.update(
          "tasks",
          tasks,
          vscode.ConfigurationTarget.WorkspaceFolder,
        );
      } else {
        throw new Error(`Cannot create task: missing label`);
      }
    }
  }
}
