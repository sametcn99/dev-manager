import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";
import { PackageManagerService } from "../services/PackageManagerService";

// Add dependency type interfaces for bulk operations
interface BulkDependencyOptions {
  action: "add" | "remove" | "update";
  packageName: string;
  version?: string;
  isDev: boolean;
  projectPaths: string[];
}

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
      // Register new commands for multi-project operations
      vscode.commands.registerCommand(
        "dev-manager.runScriptAcrossProjects",
        this.handleRunScriptAcrossProjects.bind(this),
      ),
      vscode.commands.registerCommand(
        "dev-manager.bulkManageDependencies",
        this.handleBulkManageDependencies.bind(this),
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

  /**
   * Handles running a script across multiple projects
   */
  private async handleRunScriptAcrossProjects() {
    const projects = await this.projectTreeProvider.getAllProjects();
    if (projects.length === 0) {
      vscode.window.showInformationMessage(
        "No Node.js projects found in workspace",
      );
      return;
    }

    // 1. First step: select projects to run script on
    const projectItems = projects.map((project) => ({
      label: project.name,
      description: project.path,
      detail: `Available scripts: ${Object.keys(project.scripts).join(", ")}`,
      picked: false,
    }));

    const selectedProjects = await vscode.window.showQuickPick(projectItems, {
      title: "Select projects to run script on",
      placeHolder: "Choose one or more projects...",
      canPickMany: true,
    });

    if (!selectedProjects || selectedProjects.length === 0) {
      return;
    }

    // Get list of common scripts across all selected projects
    const selectedProjectPaths = selectedProjects.map(
      (project) => project.description,
    );
    const selectedProjectObjects = projects.filter((project) =>
      selectedProjectPaths.includes(project.path),
    );

    // Find common scripts available in all selected projects
    const allScripts = new Set<string>();
    const scriptCounts: Record<string, number> = {};

    // Count occurrences of each script
    for (const project of selectedProjectObjects) {
      Object.keys(project.scripts).forEach((script) => {
        allScripts.add(script);
        scriptCounts[script] = (scriptCounts[script] || 0) + 1;
      });
    }

    // Filter scripts that exist in all selected projects
    const commonScripts = Array.from(allScripts).filter(
      (script) => scriptCounts[script] === selectedProjectObjects.length,
    );

    const uniqueScripts = Array.from(allScripts);

    // 2. Second step: select script to run
    const scriptItems = uniqueScripts.map((script) => ({
      label: script,
      description: commonScripts.includes(script)
        ? "Available in all selected projects"
        : `Available in ${scriptCounts[script]}/${selectedProjectObjects.length} projects`,
      picked: commonScripts.includes(script),
    }));

    const selectedScript = await vscode.window.showQuickPick(scriptItems, {
      title: "Select script to run",
      placeHolder: "Choose a script to run across projects...",
    });

    if (!selectedScript) {
      return;
    }

    // Find projects that have this script
    const projectsWithScript = selectedProjectObjects.filter(
      (project) => project.scripts[selectedScript.label] !== undefined,
    );

    if (projectsWithScript.length === 0) {
      vscode.window.showWarningMessage(
        `No selected projects have the script "${selectedScript.label}"`,
      );
      return;
    }

    // 3. Third step: ask if scripts should run sequentially or parallel
    const runMode = await vscode.window.showQuickPick(
      [
        {
          label: "Sequential",
          description:
            "Run scripts one after another, waiting for each to complete",
        },
        {
          label: "Parallel",
          description: "Run all scripts simultaneously",
        },
      ],
      {
        title: "How should scripts be executed?",
        placeHolder: "Select execution mode...",
      },
    );

    if (!runMode) {
      return;
    }

    // Create terminal only after run mode is selected
    const terminal = vscode.window.createTerminal(
      `Multi-Project Script: ${selectedScript.label}`,
    );
    terminal.show();

    if (runMode.label === "Sequential") {
      // Run scripts sequentially with && between commands
      let commandChain = "";
      for (let i = 0; i < projectsWithScript.length; i++) {
        const project = projectsWithScript[i];
        const separator = i < projectsWithScript.length - 1 ? " && " : "";
        commandChain += `cd "${project.path}" && echo "Running ${selectedScript.label} in ${project.name}..." && npm run ${selectedScript.label}${separator}`;
      }
      terminal.sendText(commandChain);
    } else {
      // Run scripts in parallel
      for (const project of projectsWithScript) {
        terminal.sendText(
          `cd "${project.path}" && echo "Running ${selectedScript.label} in ${project.name}..." && npm run ${selectedScript.label} &`,
        );
      }
      // Add wait command at the end to keep terminal open
      terminal.sendText("wait");
    }

    vscode.window.showInformationMessage(
      `Running script "${selectedScript.label}" in ${projectsWithScript.length} projects...`,
    );
  }

  /**
   * Handles bulk dependency management across multiple projects
   */
  private async handleBulkManageDependencies() {
    const projects = await this.projectTreeProvider.getAllProjects();
    if (projects.length === 0) {
      vscode.window.showInformationMessage(
        "No Node.js projects found in workspace",
      );
      return;
    }

    // 1. First step: select projects
    const projectItems = projects.map((project) => ({
      label: project.name,
      description: project.path,
      detail: `Dependencies: ${project.dependencies.length} | Dev Dependencies: ${project.devDependencies.length}`,
      picked: false,
    }));

    const selectedProjects = await vscode.window.showQuickPick(projectItems, {
      title: "Select projects for dependency management",
      placeHolder: "Choose one or more projects...",
      canPickMany: true,
    });

    if (!selectedProjects || selectedProjects.length === 0) {
      return;
    }

    const selectedProjectPaths = selectedProjects.map(
      (project) => project.description,
    );

    // 2. Second step: select action
    const action = await vscode.window.showQuickPick(
      [
        {
          label: "Add dependency",
          detail: "Add a new dependency to selected projects",
        },
        {
          label: "Remove dependency",
          detail: "Remove a dependency from selected projects",
        },
        {
          label: "Update dependency",
          detail: "Update a dependency in selected projects",
        },
      ],
      {
        title: "Select dependency action",
        placeHolder: "Choose an action...",
      },
    );

    if (!action) {
      return;
    }

    // 3. Third step: get dependency details
    const dependencyAction = action.label.split(" ")[0].toLowerCase() as
      | "add"
      | "remove"
      | "update";

    // For removal or update, show list of common dependencies
    if (dependencyAction === "remove" || dependencyAction === "update") {
      // Get all dependencies from selected projects
      const selectedProjectObjects = projects.filter((project) =>
        selectedProjectPaths.includes(project.path),
      );

      const allDependencies = new Set<string>();
      const allDevDependencies = new Set<string>();

      // Collect all dependencies
      for (const project of selectedProjectObjects) {
        project.dependencies.forEach((dep) => allDependencies.add(dep.name));
        project.devDependencies.forEach((dep) =>
          allDevDependencies.add(dep.name),
        );
      }

      // Create quick pick items
      const dependencyItems = [
        ...Array.from(allDependencies).map((name) => ({
          label: name,
          description: "Production dependency",
          detail: "Used in one or more selected projects",
          isDev: false,
        })),
        ...Array.from(allDevDependencies).map((name) => ({
          label: name,
          description: "Development dependency",
          detail: "Used in one or more selected projects",
          isDev: true,
        })),
      ];

      const selectedDependency = await vscode.window.showQuickPick(
        dependencyItems,
        {
          title: `Select dependency to ${dependencyAction}`,
          placeHolder: "Choose a dependency...",
        },
      );

      if (!selectedDependency) {
        return;
      }

      // For update action, get the version
      let version: string | undefined;
      if (dependencyAction === "update") {
        // Get available versions
        const versions = await this.packageManagerService.getPackageVersions(
          selectedDependency.label,
        );

        if (!versions || versions.length === 0) {
          vscode.window.showErrorMessage(
            `Failed to fetch versions for ${selectedDependency.label}`,
          );
          return;
        }

        const versionItems = [
          { label: "Latest", description: versions[0] },
          {
            label: `^${versions[0]}`,
            description: "Compatible with most recent major version",
          },
          {
            label: `~${versions[0]}`,
            description: "Compatible with most recent minor version",
          },
          ...versions.slice(0, 20).map((v) => ({ label: v })), // Limit to 20 versions to avoid too many options
        ];

        const selectedVersion = await vscode.window.showQuickPick(
          versionItems,
          {
            title: `Select version for ${selectedDependency.label}`,
            placeHolder: "Choose a version...",
          },
        );

        if (!selectedVersion) {
          return;
        }

        version =
          selectedVersion.label === "Latest"
            ? versions[0]
            : selectedVersion.label;
      }

      // Execute the bulk action for remove or update
      await this.executeBulkDependencyAction({
        action: dependencyAction,
        packageName: selectedDependency.label,
        version,
        isDev: selectedDependency.isDev,
        projectPaths: selectedProjectPaths,
      });
    } else if (dependencyAction === "add") {
      // For add action, let user search for a package
      const packageName = await vscode.window.showInputBox({
        title: "Enter package name to add",
        placeHolder: "e.g., lodash, react, express...",
      });

      if (!packageName) {
        return;
      }

      // Fetch versions for the package
      const versions =
        await this.packageManagerService.getPackageVersions(packageName);

      if (!versions || versions.length === 0) {
        vscode.window.showErrorMessage(
          `No versions found for package ${packageName}`,
        );
        return;
      }

      // Let user select a version
      const versionItems = [
        { label: "Latest", description: versions[0] },
        {
          label: `^${versions[0]}`,
          description: "Compatible with most recent major version",
        },
        {
          label: `~${versions[0]}`,
          description: "Compatible with most recent minor version",
        },
        ...versions.slice(0, 20).map((v) => ({ label: v })),
      ];

      const selectedVersion = await vscode.window.showQuickPick(versionItems, {
        title: `Select version for ${packageName}`,
        placeHolder: "Choose a version...",
      });

      if (!selectedVersion) {
        return;
      }

      // Let user choose if it's a dev dependency
      const dependencyType = await vscode.window.showQuickPick(
        [
          { label: "Production", description: "Regular dependency" },
          { label: "Development", description: "devDependency" },
        ],
        {
          title: "Select dependency type",
          placeHolder: "Production or Development dependency?",
        },
      );

      if (!dependencyType) {
        return;
      }

      const version =
        selectedVersion.label === "Latest"
          ? versions[0]
          : selectedVersion.label;
      const isDev = dependencyType.label === "Development";

      // Execute the bulk action for add
      await this.executeBulkDependencyAction({
        action: "add",
        packageName,
        version,
        isDev,
        projectPaths: selectedProjectPaths,
      });
    }
  }

  /**
   * Executes a bulk dependency action across multiple projects
   */
  private async executeBulkDependencyAction(options: BulkDependencyOptions) {
    const { action, packageName, version, isDev, projectPaths } = options;

    // Show progress indicator
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `${this.capitalize(action)}ing ${packageName} in ${projectPaths.length} projects...`,
        cancellable: false,
      },
      async (progress) => {
        // Create a terminal for the operations
        const terminal = vscode.window.createTerminal(
          `Bulk ${this.capitalize(action)} - ${packageName}`,
        );
        terminal.show();

        // We'll use the first project's package manager for the command output example
        const firstProject = (
          await this.projectTreeProvider.getAllProjects()
        ).find((p) => p.path === projectPaths[0]);

        if (!firstProject) {
          return;
        }

        const packageManager = firstProject.packageManager;

        // Get command templates
        const commands: Record<string, Record<string, string>> = {
          add: {
            npm: isDev ? "npm install --save-dev" : "npm install --save",
            yarn: isDev ? "yarn add -D" : "yarn add",
            pnpm: isDev ? "pnpm add -D" : "pnpm add",
            bun: isDev ? "bun add -d" : "bun add",
          },
          remove: {
            npm: "npm uninstall",
            yarn: "yarn remove",
            pnpm: "pnpm remove",
            bun: "bun remove",
          },
          update: {
            npm: "npm install",
            yarn: "yarn add",
            pnpm: "pnpm add",
            bun: "bun add",
          },
        };

        // Execute commands for each project
        for (let i = 0; i < projectPaths.length; i++) {
          const projectPath = projectPaths[i];

          // Find project object to get its package manager
          const project = (
            await this.projectTreeProvider.getAllProjects()
          ).find((p) => p.path === projectPath);

          if (!project) {
            continue;
          }

          // Create command based on action and project's package manager
          let cmd: string;
          const cmdTemplate = commands[action][project.packageManager];

          if (action === "add" || action === "update") {
            cmd = `${cmdTemplate} ${packageName}${version ? `@${version}` : ""}`;
          } else {
            cmd = `${cmdTemplate} ${packageName}`;
          }

          progress.report({
            message: `${i + 1}/${projectPaths.length}: ${project.name}`,
            increment: 100 / projectPaths.length,
          });

          terminal.sendText(
            `cd "${projectPath}" && echo "Project: ${project.name}" && ${cmd}`,
          );

          // Add small delay between commands to improve readability in terminal
          if (i < projectPaths.length - 1) {
            terminal.sendText(
              'echo "\\n-----------------------------------\\n"',
            );
          }
        }

        // Refresh the tree view to show changes
        this.projectTreeProvider.refresh();

        vscode.window.showInformationMessage(
          `Finished ${action}ing ${packageName} in ${projectPaths.length} projects`,
        );
      },
    );
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
