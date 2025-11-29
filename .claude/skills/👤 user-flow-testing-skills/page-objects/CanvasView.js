/**
 * Canvas View Page Object Model
 * Represents the canvas workspace view in Pomo-Flow
 */

const BasePage = require('./BasePage');

class CanvasView extends BasePage {
  constructor(page) {
    super(page);
    this.viewName = 'Canvas View';
    this.url = `${this.baseURL}/canvas`;
  }

  /**
   * Canvas view specific selectors
   */
  get selectors() {
    return {
      // Navigation
      canvasNav: '[data-testid="nav-canvas"]',
      viewTitle: '[data-testid="view-title"]',

      // Canvas area
      canvasContainer: '[data-testid="canvas-container"]',
      canvasArea: '[data-testid="canvas-area"]',
      canvasViewport: '[data-testid="canvas-viewport"]',

      // Task nodes
      taskNode: '[data-testid="canvas-task-node"]',
      taskNodeTitle: '[data-testid="task-node-title"]',
      taskNodeDescription: '[data-testid="task-node-description"]',
      taskNodePriority: '[data-testid="task-node-priority"]',
      taskNodeStatus: '[data-testid="task-node-status"]',
      taskNodeProgress: '[data-testid="task-node-progress"]',
      taskNodeHandles: '[data-testid="connection-handle"]',
      taskNodeResizeHandle: '[data-testid="resize-handle"]',

      // Sections
      section: '[data-testid="canvas-section"]',
      sectionHeader: '[data-testid="section-header"]',
      sectionTitle: '[data-testid="section-title"]',
      sectionContent: '[data-testid="section-content"]',
      sectionCollapseButton: '[data-testid="section-collapse-button"]',
      sectionExpandButton: '[data-testid="section-expand-button"]',
      sectionAddTaskButton: '[data-testid="section-add-task"]',

      // Section types
      prioritySection: '[data-testid="section-priority"]',
      statusSection: '[data-testid="section-status"]',
      projectSection: '[data-testid="section-project"]',
      customSection: '[data-testid="section-custom"]',

      // Canvas controls
      zoomInButton: '[data-testid="zoom-in"]',
      zoomOutButton: '[data-testid="zoom-out"]',
      zoomResetButton: '[data-testid="zoom-reset"]',
      fitToScreenButton: '[data-testid="fit-to-screen"]',
      centerCanvasButton: '[data-testid="center-canvas"]',

      // Canvas tools
      selectTool: '[data-testid="select-tool"]',
      panTool: '[data-testid="pan-tool"]',
      connectTool: '[data-testid="connect-tool"]',
      createTool: '[data-testid="create-tool"]',

      // Context menus
      contextMenu: '[data-testid="context-menu"]',
      createTaskHere: '[data-testid="create-task-here"]',
      createSectionHere: '[data-testid="create-section-here"]',
      deleteNode: '[data-testid="delete-node"]',
      editNode: '[data-testid="edit-node"]',
      duplicateNode: '[data-testid="duplicate-node"]',

      // Connections
      connection: '[data-testid="task-connection"]',
      connectionLine: '[data-testid="connection-line"]',
      connectionArrow: '[data-testid="connection-arrow"]',
      deleteConnection: '[data-testid="delete-connection"]',

      // Selection
      selectionRectangle: '[data-testid="selection-rectangle"]',
      multiSelectionHandle: '[data-testid="multi-selection-handle"]',
      selectedNodes: '[data-testid="selected-node"]',

      // Mini map
      minimap: '[data-testid="minimap"]',
      minimapViewport: '[data-testid="minimap-viewport"]',

      // Canvas settings
      canvasSettings: '[data-testid="canvas-settings"]',
      gridToggle: '[data-testid="grid-toggle"]',
      snapToGridToggle: '[data-testid="snap-to-grid-toggle"]',
      showConnectionsToggle: '[data-testid="show-connections-toggle"]',

      // Task creation modal in canvas
      canvasTaskModal: '[data-testid="canvas-task-modal"]',
      canvasTaskTitle: '[data-testid="canvas-task-title"]',
      canvasTaskDescription: '[data-testid="canvas-task-description"]',
      canvasTaskSave: '[data-testid="canvas-task-save"]',
      canvasTaskCancel: '[data-testid="canvas-task-cancel"]',

      // Section creation modal
      sectionModal: '[data-testid="section-modal"]',
      sectionNameInput: '[data-testid="section-name-input"]',
      sectionTypeSelect: '[data-testid="section-type-select"]',
      sectionFilterInput: '[data-testid="section-filter-input"]',
      saveSectionButton: '[data-testid="save-section"]',

      // Empty state
      canvasEmpty: '[data-testid="canvas-empty"]',
      createFirstNodeButton: '[data-testid="create-first-node"]',

      // Loading states
      canvasLoading: '[data-testid="canvas-loading"]"
    };
  }

  /**
   * Navigate to canvas view
   */
  async navigateToCanvas() {
    await this.navigate(this.url);
    await this.waitForCanvasView();
  }

  /**
   * Wait for canvas view to be loaded
   */
  async waitForCanvasView() {
    await this.waitForPageLoad();
    await this.getElement(this.selectors.canvasNav);
    await this.getElement(this.selectors.canvasArea);
  }

  /**
   * Create task node at specific position
   */
  async createTaskAt(position, taskData = {}) {
    const defaultTaskData = {
      title: `Canvas Task ${Date.now()}`,
      description: 'Auto-generated canvas task',
      priority: 'medium',
      status: 'planned'
    };

    const task = { ...defaultTaskData, ...taskData };

    // Right click at position
    await this.page.mouse.click(position.x, position.y, { button: 'right' });
    await this.waitForElement(this.selectors.contextMenu);

    // Click "Create Task Here"
    await this.click(this.selectors.createTaskHere);
    await this.waitForElement(this.selectors.canvasTaskModal);

    // Fill task details
    await this.fill(this.selectors.canvasTaskTitle, task.title);
    await this.fill(this.selectors.canvasTaskDescription, task.description);

    // Set priority and status if provided
    if (task.priority) {
      await this.selectOption(`[data-testid="canvas-task-priority"]`, task.priority);
    }

    if (task.status) {
      await this.selectOption(`[data-testid="canvas-task-status"]`, task.status);
    }

    await this.click(this.selectors.canvasTaskSave);
    await this.waitForElementToDisappear(this.selectors.canvasTaskModal);

    return task;
  }

  /**
   * Create task via context menu
   */
  async createTaskViaContextMenu(x, y, taskData = {}) {
    return await this.createTaskAt({ x, y }, taskData);
  }

  /**
   * Get task node by title
   */
  async getTaskNode(title) {
    const taskNodes = await this.page.$$(this.selectors.taskNode);

    for (const node of taskNodes) {
      const nodeTitle = await node.locator(this.selectors.taskNodeTitle).textContent();
      if (nodeTitle && nodeTitle.trim() === title) {
        return node;
      }
    }

    return null;
  }

  /**
   * Get position of task node
   */
  async getTaskNodePosition(title) {
    const taskNode = await this.getTaskNode(title);
    if (!taskNode) {
      throw new Error(`Task node "${title}" not found`);
    }

    const boundingBox = await taskNode.boundingBox();
    return {
      x: boundingBox.x,
      y: boundingBox.y,
      width: boundingBox.width,
      height: boundingBox.height
    };
  }

  /**
   * Drag task node to new position
   */
  async dragTaskToPosition(title, targetPosition) {
    const taskNode = await this.getTaskNode(title);
    if (!taskNode) {
      throw new Error(`Task node "${title}" not found`);
    }

    const currentPosition = await taskNode.boundingBox();
    const centerX = currentPosition.x + currentPosition.width / 2;
    const centerY = currentPosition.y + currentPosition.height / 2;

    await this.page.mouse.move(centerX, centerY);
    await this.page.mouse.down();
    await this.page.mouse.move(targetPosition.x, targetPosition.y);
    await this.page.mouse.up();
  }

  /**
   * Drag task node to another position relative to current
   */
  async dragTaskByOffset(title, offsetX, offsetY) {
    const currentPosition = await this.getTaskNodePosition(title);
    const targetPosition = {
      x: currentPosition.x + offsetX,
      y: currentPosition.y + offsetY
    };

    await this.dragTaskToPosition(title, targetPosition);
    return targetPosition;
  }

  /**
   * Create connection between two task nodes
   */
  async createConnection(sourceTask, targetTask) {
    const sourceNode = await this.getTaskNode(sourceTask);
    const targetNode = await this.getTaskNode(targetTask);

    if (!sourceNode || !targetNode) {
      throw new Error('Source or target task node not found');
    }

    // Hover over source node to show connection handles
    await sourceNode.hover();
    await this.waitForElement(this.selectors.taskNodeHandles);

    // Click on source handle
    const sourceHandle = await sourceNode.locator(this.selectors.taskNodeHandles).first();
    await sourceHandle.click();

    // Click on target node
    await targetNode.click();

    // Wait for connection to be created
    await this.waitForElement(this.selectors.connection);
  }

  /**
   * Delete connection between tasks
   */
  async deleteConnection(sourceTask, targetTask) {
    // Find connection line between the two tasks
    const connections = await this.page.$$(this.selectors.connection);

    for (const connection of connections) {
      // This is a simplified approach - in a real implementation,
      // you'd need to identify the specific connection
      await connection.hover();
      await this.click(this.selectors.deleteConnection);
      break;
    }
  }

  /**
   * Delete task node
   */
  async deleteTaskNode(title) {
    const taskNode = await this.getTaskNode(title);
    if (!taskNode) {
      throw new Error(`Task node "${title}" not found`);
    }

    // Right click on task node
    await taskNode.click({ button: 'right' });
    await this.waitForElement(this.selectors.contextMenu);

    // Click delete
    await this.click(this.selectors.deleteNode);

    // Confirm deletion if needed
    const confirmButton = await this.page.locator('[data-testid="confirm-delete"]');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    await this.waitForElementToDisappear(taskNode);
  }

  /**
   * Edit task node
   */
  async editTaskNode(title, updates = {}) {
    const taskNode = await this.getTaskNode(title);
    if (!taskNode) {
      throw new Error(`Task node "${title}" not found`);
    }

    // Right click on task node
    await taskNode.click({ button: 'right' });
    await this.waitForElement(this.selectors.contextMenu);

    // Click edit
    await this.click(this.selectors.editNode);
    await this.waitForElement(this.selectors.canvasTaskModal);

    // Update fields
    if (updates.title) {
      await this.fill(this.selectors.canvasTaskTitle, updates.title);
    }

    if (updates.description) {
      await this.fill(this.selectors.canvasTaskDescription, updates.description);
    }

    if (updates.priority) {
      await this.selectOption(`[data-testid="canvas-task-priority"]`, updates.priority);
    }

    if (updates.status) {
      await this.selectOption(`[data-testid="canvas-task-status"]`, updates.status);
    }

    await this.click(this.selectors.canvasTaskSave);
    await this.waitForElementToDisappear(this.selectors.canvasTaskModal);

    return updates;
  }

  /**
   * Duplicate task node
   */
  async duplicateTaskNode(title) {
    const taskNode = await this.getTaskNode(title);
    if (!taskNode) {
      throw new Error(`Task node "${title}" not found`);
    }

    // Right click on task node
    await taskNode.click({ button: 'right' });
    await this.waitForElement(this.selectors.contextMenu);

    // Click duplicate
    await this.click(this.selectors.duplicateNode);

    // Wait for duplicate to appear
    await this.wait(1000);
  }

  /**
   * Select task node
   */
  async selectTaskNode(title) {
    const taskNode = await this.getTaskNode(title);
    if (!taskNode) {
      throw new Error(`Task node "${title}" not found`);
    }

    await taskNode.click();
  }

  /**
   * Select multiple task nodes with rectangle selection
   */
  async selectNodesWithRectangle(startX, startY, endX, endY) {
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(endX, endY);
    await this.page.mouse.up();

    await this.waitForElement(this.selectors.selectionRectangle);
  }

  /**
   * Get all selected nodes
   */
  async getSelectedNodes() {
    const selectedNodes = await this.page.$$(this.selectors.selectedNodes);
    const nodes = [];

    for (const node of selectedNodes) {
      const title = await node.locator(this.selectors.taskNodeTitle).textContent();
      nodes.push({
        title: title?.trim(),
        element: node
      });
    }

    return nodes;
  }

  /**
   * Create section
   */
  async createSection(sectionData = {}) {
    const defaultSectionData = {
      name: `New Section ${Date.now()}`,
      type: 'custom',
      filter: ''
    };

    const section = { ...defaultSectionData, ...sectionData };

    // Right click on canvas area
    await this.page.click(this.selectors.canvasArea, { button: 'right' });
    await this.waitForElement(this.selectors.contextMenu);

    // Click "Create Section Here"
    await this.click(this.selectors.createSectionHere);
    await this.waitForElement(this.selectors.sectionModal);

    // Fill section details
    await this.fill(this.selectors.sectionNameInput, section.name);
    await this.selectOption(this.selectors.sectionTypeSelect, section.type);

    if (section.filter) {
      await this.fill(this.selectors.sectionFilterInput, section.filter);
    }

    await this.click(this.selectors.saveSectionButton);
    await this.waitForElementToDisappear(this.selectors.sectionModal);

    return section;
  }

  /**
   * Collapse section
   */
  async collapseSection(sectionName) {
    const section = await this.getSection(sectionName);
    if (!section) {
      throw new Error(`Section "${sectionName}" not found`);
    }

    await section.locator(this.selectors.sectionCollapseButton).click();
  }

  /**
   * Expand section
   */
  async expandSection(sectionName) {
    const section = await this.getSection(sectionName);
    if (!section) {
      throw new Error(`Section "${sectionName}" not found`);
    }

    await section.locator(this.selectors.sectionExpandButton).click();
  }

  /**
   * Get section by name
   */
  async getSection(name) {
    const sections = await this.page.$$(this.selectors.section);

    for (const section of sections) {
      const sectionTitle = await section.locator(this.selectors.sectionTitle).textContent();
      if (sectionTitle && sectionTitle.trim() === name) {
        return section;
      }
    }

    return null;
  }

  /**
   * Get tasks in section
   */
  async getTasksInSection(sectionName) {
    const section = await this.getSection(sectionName);
    if (!section) {
      throw new Error(`Section "${sectionName}" not found`);
    }

    const taskNodes = await section.$$(this.selectors.taskNode);
    const tasks = [];

    for (const node of taskNodes) {
      const title = await node.locator(this.selectors.taskNodeTitle).textContent();
      const priority = await node.locator(this.selectors.taskNodePriority).textContent();
      const status = await node.locator(this.selectors.taskNodeStatus).textContent();

      tasks.push({
        title: title?.trim(),
        priority: priority?.trim(),
        status: status?.trim()
      });
    }

    return tasks;
  }

  /**
   * Zoom in
   */
  async zoomIn() {
    await this.click(this.selectors.zoomInButton);
  }

  /**
   * Zoom out
   */
  async zoomOut() {
    await this.click(this.selectors.zoomOutButton);
  }

  /**
   * Reset zoom
   */
  async resetZoom() {
    await this.click(this.selectors.zoomResetButton);
  }

  /**
   * Fit canvas to screen
   */
  async fitToScreen() {
    await this.click(this.selectors.fitToScreenButton);
  }

  /**
   * Center canvas
   */
  async centerCanvas() {
    await this.click(this.selectors.centerCanvasButton);
  }

  /**
   * Select tool
   */
  async selectTool(toolName) {
    const toolSelector = `[data-testid="${toolName}-tool"]`;
    await this.click(toolSelector);
  }

  /**
   * Pan canvas
   */
  async panCanvas(startX, startY, endX, endY) {
    await this.selectTool('pan');

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(endX, endY);
    await this.page.mouse.up();

    // Return to select tool
    await this.selectTool('select');
  }

  /**
   * Toggle grid
   */
  async toggleGrid() {
    await this.click(this.selectors.canvasSettings);
    await this.click(this.selectors.gridToggle);
  }

  /**
   * Toggle snap to grid
   */
  async toggleSnapToGrid() {
    await this.click(this.selectors.canvasSettings);
    await this.click(this.selectors.snapToGridToggle);
  }

  /**
   * Toggle show connections
   */
  async toggleShowConnections() {
    await this.click(this.selectors.canvasSettings);
    await this.click(this.selectors.showConnectionsToggle);
  }

  /**
   * Get canvas viewport information
   */
  async getViewportInfo() {
    const viewport = await this.getElement(this.selectors.canvasViewport);
    const boundingBox = await viewport.boundingBox();

    return {
      x: boundingBox.x,
      y: boundingBox.y,
      width: boundingBox.width,
      height: boundingBox.height
    };
  }

  /**
   * Get all task nodes on canvas
   */
  async getAllTaskNodes() {
    const taskNodes = await this.page.$$(this.selectors.taskNode);
    const nodes = [];

    for (const node of taskNodes) {
      try {
        const title = await node.locator(this.selectors.taskNodeTitle).textContent();
        const description = await node.locator(this.selectors.taskNodeDescription).textContent();
        const priority = await node.locator(this.selectors.taskNodePriority).textContent();
        const status = await node.locator(this.selectors.taskNodeStatus).textContent();
        const position = await node.boundingBox();

        nodes.push({
          title: title?.trim(),
          description: description?.trim(),
          priority: priority?.trim(),
          status: status?.trim(),
          position: {
            x: position.x,
            y: position.y,
            width: position.width,
            height: position.height
          }
        });
      } catch (error) {
        // Skip nodes that don't have all elements
        continue;
      }
    }

    return nodes;
  }

  /**
   * Get all connections on canvas
   */
  async getAllConnections() {
    const connections = await this.page.$$(this.selectors.connection);
    const connectionData = [];

    for (const connection of connections) {
      // In a real implementation, you'd extract source and target node information
      connectionData.push({
        element: connection
      });
    }

    return connectionData;
  }

  /**
   * Check if canvas is empty
   */
  async isEmpty() {
    const taskNodes = await this.page.$$(this.selectors.taskNode);
    const sections = await this.page.$$(this.selectors.section);

    return taskNodes.length === 0 && sections.length === 0;
  }

  /**
   * Wait for task node to appear
   */
  async waitForTaskNode(title, timeout = 10000) {
    await this.page.waitForFunction(
      ({ selector, title }) => {
        const nodes = document.querySelectorAll(selector);
        return Array.from(nodes).some(node => {
          const titleElement = node.querySelector('[data-testid="task-node-title"]');
          return titleElement && titleElement.textContent.trim() === title;
        });
      },
      { selector: this.selectors.taskNode, title: title },
      { timeout }
    );
  }

  /**
   * Verify task node exists
   */
  async taskNodeExists(title) {
    const taskNode = await this.getTaskNode(title);
    return taskNode !== null;
  }

  /**
   * Get task node details
   */
  async getTaskNodeDetails(title) {
    const taskNode = await this.getTaskNode(title);
    if (!taskNode) {
      return null;
    }

    const title = await taskNode.locator(this.selectors.taskNodeTitle).textContent();
    const description = await taskNode.locator(this.selectors.taskNodeDescription).textContent();
    const priority = await taskNode.locator(this.selectors.taskNodePriority).textContent();
    const status = await taskNode.locator(this.selectors.taskNodeStatus).textContent();
    const progress = await taskNode.locator(this.selectors.taskNodeProgress).textContent();
    const position = await taskNode.boundingBox();

    return {
      title: title?.trim(),
      description: description?.trim(),
      priority: priority?.trim(),
      status: status?.trim(),
      progress: progress?.trim(),
      position: {
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height
      }
    };
  }
}

module.exports = CanvasView;