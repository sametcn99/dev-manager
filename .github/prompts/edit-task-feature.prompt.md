# Edit Task Feature

## Feature Overview

Enhance the Dev Manager extension by adding the capability to edit existing tasks. Currently, users can create and delete tasks, but editing functionality is missing.

## Requirements

### Core Functionality

- Add an "Edit Task" command that can be triggered from the task tree view
- Reuse the existing `TaskWebView` with modifications to support editing mode
- Populate the task editor form with existing task data
- Update the task instead of creating a new one when in edit mode
- Preserve custom/additional properties during the edit process
- Ensure proper communication between taskEditor.html and the service layer is established for both create and edit operations

### UI/UX Considerations

- Add "Edit" button to task items in the tree view
- Modify the task editor title and save button text to reflect edit mode
- Provide visual feedback during and after the task update process

### Implementation Details

#### TaskWebView Modifications

- Update `TaskWebView` to accept an optional existing task parameter
- Modify the initialization logic to populate form fields with existing task data
- Add a mode flag to differentiate between "create" and "edit" operations
- Update the save handler to call the appropriate service method based on mode
- Verify that the existing message passing mechanism between taskEditor.html and the extension host properly supports the edit functionality

#### TaskService Enhancements

- Add an `updateTask` method to handle task updates, completely separate from the existing `createTask` method
- Implement clear separation between creation and editing functionality in the service layer
- Ensure both functions maintain their distinct responsibilities without code duplication
- Ensure proper error handling and validation during updates
- Maintain task ID consistency during updates

#### Command Registration

- Register a new `dev-manager.editTask` command
- Connect the command to the task tree item context menu
- Pass the selected task to the `TaskWebView` when editing

## Expected Workflow

1. User right-clicks on a task in the task tree view and selects "Edit Task"
2. The task editor opens with all fields populated with the task's current values
3. User modifies desired fields
4. User clicks "Save" (or equivalent)
5. The task is updated with the new values
6. The task tree view refreshes to show the updated task

## Technical Considerations

- Ensure backward compatibility with existing task creation functionality
- Maintain type safety with proper TypeScript interfaces
- Follow the extension's existing architectural patterns
- Handle potential edge cases (e.g., concurrent edits, validation failures)
- Keep create and edit functionalities distinctly separated throughout the implementation
- Validate the WebView postMessage communication channel for proper data exchange between taskEditor.html and the extension host
