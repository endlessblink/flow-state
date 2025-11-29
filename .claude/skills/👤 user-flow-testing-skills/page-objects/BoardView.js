/**
 * Board View Page Object Model
 * Represents the Kanban board view in Pomo-Flow
 */

const BasePage = require('./BasePage');

class BoardView extends BasePage {
  constructor(page) {
    super(page);
    this.viewName = 'Board View';
    this.url = `${this.baseURL}/board`;
  }

  /**
   * Board view specific selectors
   */
  get selectors() {
    return {
      // Navigation
      boardNav: '[data-testid="nav-board"]',
      viewTitle: '[data-testid="view-title"]',

      // Task management
      addTaskButton: '[data-testid="add-task-button"]',
      taskCard: '[data-testid="task-card"]',
      taskTitle: '[data-testid="task-title"]',
      taskDescription: '[data-testid="task-description"]',
      taskPriority: '[data-testid="task-priority"]',
      taskStatus: '[data-testid="task-status"]',
      taskProgress: '[data-testid="task-progress"]',
      taskEditButton: '[data-testid="task-edit-button"]',
      taskDeleteButton: '[data-testid="task-delete-button"]',
      taskCompleteButton: '[data-testid="task-complete-button"]',

      // Kanban columns
      kanbanColumn: '[data-testid="kanban-column"]',
      columnHeader: '[data-testid="column-header"]',
      columnTitle: '[data-testid="column-title"]',
      columnTasks: '[data-testid="column-tasks"]',

      // Status columns
      backlogColumn: '[data-testid="column-backlog"]',
      plannedColumn: '[data-testid="column-planned"]',
      inProgressColumn: '[data-testid="column-in-progress"]',
      doneColumn: '[data-testid="column-done"]',
      onHoldColumn: '[data-testid="column-on-hold"]',

      // Task creation modal
      taskModal: '[data-testid="task-modal"]',
      modalTitle: '[data-testid="modal-title"]',
      taskTitleInput: '[data-testid="task-title-input"]',
      taskDescriptionInput: '[data-testid="task-description-input"]',
      taskPrioritySelect: '[data-testid="task-priority-select"]',
      taskStatusSelect: '[data-testid="task-status-select"]',
      taskProjectSelect: '[data-testid="task-project-select"]',
      taskDueDateInput: '[data-testid="task-due-date-input"]',
      taskEstimatedDuration: '[data-testid="task-estimated-duration"]',
      saveTaskButton: '[data-testid="save-task-button"]',
      cancelButton: '[data-testid="cancel-button"]',

      // Filters and search
      searchInput: '[data-testid="search-input"]',
      filterStatus: '[data-testid="filter-status"]',
      filterPriority: '[data-testid="filter-priority"]',
      filterProject: '[data-testid="filter-project"]',
      clearFilters: '[data-testid="clear-filters"]',

      // Bulk operations
      selectAllCheckbox: '[data-testid="select-all-checkbox"]',
      taskCheckbox: '[data-testid="task-checkbox"]',
      bulkActions: '[data-testid="bulk-actions"]',
      bulkStatusChange: '[data-testid="bulk-status-change"]',
      bulkDelete: '[data-testid="bulk-delete"]',

      // Sorting
      sortBy: '[data-testid="sort-by"]',
      sortOrder: '[data-testid="sort-order"]',

      // View settings
      viewSettings: '[data-testid="view-settings"]',
      densityToggle: '[data-testid="density-toggle"]',
      showCompletedToggle: '[data-testid="show-completed-toggle"]',

      // Empty states
      emptyState: '[data-testid="empty-state"]',
      emptyStateMessage: '[data-testid="empty-state-message"]',
      createFirstTaskButton: '[data-testid="create-first-task-button"]'
    };
  }

  /**
   * Navigate to board view
   */
  async navigateToBoard() {
    await this.navigate(this.url);
    await this.waitForBoardView();
  }

  /**
   * Wait for board view to be loaded
   */
  async waitForBoardView() {
    await this.waitForPageLoad();
    await this.getElement(this.selectors.boardNav);
    await this.getElement(this.selectors.kanbanColumn);
  }

  /**
   * Add a new task
   */
  async addTask(taskData = {}) {
    const defaultTaskData = {
      title: `Test Task ${Date.now()}`,
      description: 'Auto-generated test task',
      priority: 'medium',
      status: 'planned',
      project: null,
      dueDate: null,
      estimatedDuration: 25
    };

    const task = { ...defaultTaskData, ...taskData };

    await this.click(this.selectors.addTaskButton);
    await this.waitForElement(this.selectors.taskModal);

    // Fill task details
    await this.fill(this.selectors.taskTitleInput, task.title);
    await this.fill(this.selectors.taskDescriptionInput, task.description);

    if (task.priority) {
      await this.selectOption(this.selectors.taskPrioritySelect, task.priority);
    }

    if (task.status) {
      await this.selectOption(this.selectors.taskStatusSelect, task.status);
    }

    if (task.project) {
      await this.selectOption(this.selectors.taskProjectSelect, task.project);
    }

    if (task.dueDate) {
      await this.fill(this.selectors.taskDueDateInput, task.dueDate);
    }

    if (task.estimatedDuration) {
      await this.fill(this.selectors.taskEstimatedDuration, task.estimatedDuration.toString());
    }

    await this.click(this.selectors.saveTaskButton);
    await this.waitForElementToDisappear(this.selectors.taskModal);

    return task;
  }

  /**
   * Edit an existing task
   */
  async editTask(taskTitle, updates = {}) {
    const taskCard = await this.findTaskCard(taskTitle);
    if (!taskCard) {
      throw new Error(`Task "${taskTitle}" not found`);
    }

    await taskCard.locator(this.selectors.taskEditButton).click();
    await this.waitForElement(this.selectors.taskModal);

    // Update fields
    if (updates.title) {
      await this.fill(this.selectors.taskTitleInput, updates.title);
    }

    if (updates.description) {
      await this.fill(this.selectors.taskDescriptionInput, updates.description);
    }

    if (updates.priority) {
      await this.selectOption(this.selectors.taskPrioritySelect, updates.priority);
    }

    if (updates.status) {
      await this.selectOption(this.selectors.taskStatusSelect, updates.status);
    }

    await this.click(this.selectors.saveTaskButton);
    await this.waitForElementToDisappear(this.selectors.taskModal);

    return updates;
  }

  /**
   * Delete a task
   */
  async deleteTask(taskTitle) {
    const taskCard = await this.findTaskCard(taskTitle);
    if (!taskCard) {
      throw new Error(`Task "${taskTitle}" not found`);
    }

    await taskCard.locator(this.selectors.taskDeleteButton).click();

    // Handle confirmation dialog if present
    const confirmButton = await this.page.locator('[data-testid="confirm-delete"]');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    await this.waitForElementToDisappear(taskCard);
  }

  /**
   * Mark task as complete
   */
  async completeTask(taskTitle) {
    const taskCard = await this.findTaskCard(taskTitle);
    if (!taskCard) {
      throw new Error(`Task "${taskTitle}" not found`);
    }

    await taskCard.locator(this.selectors.taskCompleteButton).click();
  }

  /**
   * Find task card by title
   */
  async findTaskCard(title) {
    const taskCards = await this.page.$$(this.selectors.taskCard);

    for (const card of taskCards) {
      const cardTitle = await card.locator(this.selectors.taskTitle).textContent();
      if (cardTitle && cardTitle.trim() === title) {
        return card;
      }
    }

    return null;
  }

  /**
   * Drag task to different column
   */
  async dragTaskToColumn(taskTitle, targetColumn) {
    const taskCard = await this.findTaskCard(taskTitle);
    if (!taskCard) {
      throw new Error(`Task "${taskTitle}" not found`);
    }

    const columnSelector = `${this.selectors.kanbanColumn}[data-status="${targetColumn}"]`;
    const targetColumnElement = await this.getElement(columnSelector);

    await taskCard.dragTo(targetColumnElement);
  }

  /**
   * Get tasks in specific column
   */
  async getTasksInColumn(status) {
    const columnSelector = `${this.selectors.kanbanColumn}[data-status="${status}"]`;
    const column = await this.getElement(columnSelector);

    const taskCards = await column.$$(this.selectors.taskCard);
    const tasks = [];

    for (const card of taskCards) {
      const title = await card.locator(this.selectors.taskTitle).textContent();
      const priority = await card.locator(this.selectors.taskPriority).textContent();
      const status = await card.locator(this.selectors.taskStatus).textContent();

      tasks.push({
        title: title?.trim(),
        priority: priority?.trim(),
        status: status?.trim()
      });
    }

    return tasks;
  }

  /**
   * Search for tasks
   */
  async searchTasks(query) {
    await this.fill(this.selectors.searchInput, query);
    await this.wait(500); // Wait for search to execute
  }

  /**
   * Filter tasks by status
   */
  async filterByStatus(status) {
    await this.click(this.selectors.filterStatus);
    await this.click(`[data-testid="filter-${status}"]`);
  }

  /**
   * Filter tasks by priority
   */
  async filterByPriority(priority) {
    await this.click(this.selectors.filterPriority);
    await this.click(`[data-testid="filter-${priority}"]`);
  }

  /**
   * Clear all filters
   */
  async clearFilters() {
    await this.click(this.selectors.clearFilters);
  }

  /**
   * Select all tasks for bulk operations
   */
  async selectAllTasks() {
    await this.click(this.selectors.selectAllCheckbox);
  }

  /**
   * Select specific task
   */
  async selectTask(taskTitle) {
    const taskCard = await this.findTaskCard(taskTitle);
    if (!taskCard) {
      throw new Error(`Task "${taskTitle}" not found`);
    }

    await taskCard.locator(this.selectors.taskCheckbox).check();
  }

  /**
   * Perform bulk status change
   */
  async bulkChangeStatus(newStatus) {
    await this.click(this.selectors.bulkActions);
    await this.click(this.selectors.bulkStatusChange);
    await this.click(`[data-testid="bulk-status-${newStatus}"]`);
  }

  /**
   * Delete selected tasks in bulk
   */
  async bulkDelete() {
    await this.click(this.selectors.bulkActions);
    await this.click(this.selectors.bulkDelete);

    // Handle confirmation
    const confirmButton = await this.page.locator('[data-testid="confirm-bulk-delete"]');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
  }

  /**
   * Sort tasks
   */
  async sortTasks(sortBy, sortOrder = 'asc') {
    await this.selectOption(this.selectors.sortBy, sortBy);
    await this.selectOption(this.selectors.sortOrder, sortOrder);
  }

  /**
   * Toggle view density
   */
  async toggleDensity() {
    await this.click(this.selectors.viewSettings);
    await this.click(this.selectors.densityToggle);
  }

  /**
   * Toggle show completed tasks
   */
  async toggleShowCompleted() {
    await this.click(this.selectors.viewSettings);
    await this.click(this.selectors.showCompletedToggle);
  }

  /**
   * Get all visible tasks
   */
  async getAllTasks() {
    const taskCards = await this.page.$$(this.selectors.taskCard);
    const tasks = [];

    for (const card of taskCards) {
      try {
        const title = await card.locator(this.selectors.taskTitle).textContent();
        const description = await card.locator(this.selectors.taskDescription).textContent();
        const priority = await card.locator(this.selectors.taskPriority).textContent();
        const status = await card.locator(this.selectors.taskStatus).textContent();
        const progress = await card.locator(this.selectors.taskProgress).textContent();

        tasks.push({
          title: title?.trim(),
          description: description?.trim(),
          priority: priority?.trim(),
          status: status?.trim(),
          progress: progress?.trim()
        });
      } catch (error) {
        // Skip cards that don't have all elements
        continue;
      }
    }

    return tasks;
  }

  /**
   * Get task count
   */
  async getTaskCount() {
    return await this.countElements(this.selectors.taskCard);
  }

  /**
   * Check if board view is empty
   */
  async isEmpty() {
    return await this.isVisible(this.selectors.emptyState);
  }

  /**
   * Get empty state message
   */
  async getEmptyStateMessage() {
    if (await this.isEmpty()) {
      return await this.getText(this.selectors.emptyStateMessage);
    }
    return null;
  }

  /**
   * Create first task from empty state
   */
  async createFirstTask() {
    if (await this.isEmpty()) {
      await this.click(this.selectors.createFirstTaskButton);
    }
  }

  /**
   * Get column information
   */
  async getColumnInfo(status) {
    const columnSelector = `${this.selectors.kanbanColumn}[data-status="${status}"]`;
    const column = await this.getElement(columnSelector);

    const title = await column.locator(this.selectors.columnTitle).textContent();
    const taskCards = await column.$$(this.selectors.taskCard);

    return {
      title: title?.trim(),
      status: status,
      taskCount: taskCards.length
    };
  }

  /**
   * Wait for task to appear
   */
  async waitForTask(taskTitle, timeout = 10000) {
    await this.page.waitForFunction(
      ({ selector, title }) => {
        const tasks = document.querySelectorAll(selector);
        return Array.from(tasks).some(task => {
          const titleElement = task.querySelector('[data-testid="task-title"]');
          return titleElement && titleElement.textContent.trim() === title;
        });
      },
      { selector: this.selectors.taskCard, title: taskTitle },
      { timeout }
    );
  }

  /**
   * Verify task exists
   */
  async taskExists(taskTitle) {
    const taskCard = await this.findTaskCard(taskTitle);
    return taskCard !== null;
  }

  /**
   * Get task details
   */
  async getTaskDetails(taskTitle) {
    const taskCard = await this.findTaskCard(taskTitle);
    if (!taskCard) {
      return null;
    }

    const title = await taskCard.locator(this.selectors.taskTitle).textContent();
    const description = await taskCard.locator(this.selectors.taskDescription).textContent();
    const priority = await taskCard.locator(this.selectors.taskPriority).textContent();
    const status = await taskCard.locator(this.selectors.taskStatus).textContent();
    const progress = await taskCard.locator(this.selectors.taskProgress).textContent();

    return {
      title: title?.trim(),
      description: description?.trim(),
      priority: priority?.trim(),
      status: status?.trim(),
      progress: progress?.trim()
    };
  }
}

module.exports = BoardView;