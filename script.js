const STORAGE_KEY = "momentum-tasks-state-v1";
const SAVE_DELAY = 180;

const state = {
  tasks: [],
  ui: {
    selectedTaskId: null,
    view: "all",
    query: "",
    status: "all",
    priority: "all",
    category: "all",
    sortBy: "smart",
    compact: false
  }
};

const elements = {
  taskForm: document.getElementById("taskForm"),
  taskTitle: document.getElementById("taskTitle"),
  taskNotes: document.getElementById("taskNotes"),
  taskCategory: document.getElementById("taskCategory"),
  taskTags: document.getElementById("taskTags"),
  taskPriority: document.getElementById("taskPriority"),
  taskDueDate: document.getElementById("taskDueDate"),
  taskEstimate: document.getElementById("taskEstimate"),
  taskFlagged: document.getElementById("taskFlagged"),
  resetFormButton: document.getElementById("resetFormButton"),
  statsGrid: document.getElementById("statsGrid"),
  completionBar: document.getElementById("completionBar"),
  completionLabel: document.getElementById("completionLabel"),
  completeAllButton: document.getElementById("completeAllButton"),
  clearCompletedButton: document.getElementById("clearCompletedButton"),
  exportButton: document.getElementById("exportButton"),
  importInput: document.getElementById("importInput"),
  themeToggle: document.getElementById("themeToggle"),
  viewSwitches: document.getElementById("viewSwitches"),
  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  priorityFilter: document.getElementById("priorityFilter"),
  categoryFilter: document.getElementById("categoryFilter"),
  sortBy: document.getElementById("sortBy"),
  listHeading: document.getElementById("listHeading"),
  resultCount: document.getElementById("resultCount"),
  taskList: document.getElementById("taskList"),
  detailEmpty: document.getElementById("detailEmpty"),
  detailForm: document.getElementById("detailForm"),
  detailTitle: document.getElementById("detailTitle"),
  detailNotes: document.getElementById("detailNotes"),
  detailCategory: document.getElementById("detailCategory"),
  detailTags: document.getElementById("detailTags"),
  detailPriority: document.getElementById("detailPriority"),
  detailDueDate: document.getElementById("detailDueDate"),
  detailEstimate: document.getElementById("detailEstimate"),
  detailFlagged: document.getElementById("detailFlagged"),
  detailMeta: document.getElementById("detailMeta"),
  deleteSelectedButton: document.getElementById("deleteSelectedButton"),
  taskItemTemplate: document.getElementById("taskItemTemplate")
};

let saveTimer = null;

init();

function init() {
  hydrateState();
  bindEvents();
  render();
}

function hydrateState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    state.tasks = Array.isArray(parsed.tasks) ? parsed.tasks.map(normalizeTask).filter(Boolean) : [];
    state.ui = { ...state.ui, ...normalizeUi(parsed.ui || {}) };
    document.body.classList.toggle("compact", Boolean(state.ui.compact));
  } catch (error) {
    console.warn("Unable to restore task state", error);
  }
}

function bindEvents() {
  elements.taskForm.addEventListener("submit", handleCreateTask);
  elements.resetFormButton.addEventListener("click", () => elements.taskForm.reset());
  elements.completeAllButton.addEventListener("click", completeVisibleTasks);
  elements.clearCompletedButton.addEventListener("click", clearCompletedTasks);
  elements.exportButton.addEventListener("click", exportTasks);
  elements.importInput.addEventListener("change", importTasks);
  elements.themeToggle.addEventListener("click", toggleDensity);
  elements.viewSwitches.addEventListener("click", handleViewSwitch);
  elements.searchInput.addEventListener("input", (event) => updateUi({ query: event.target.value }));
  elements.statusFilter.addEventListener("change", (event) => updateUi({ status: event.target.value }));
  elements.priorityFilter.addEventListener("change", (event) => updateUi({ priority: event.target.value }));
  elements.categoryFilter.addEventListener("change", (event) => updateUi({ category: event.target.value }));
  elements.sortBy.addEventListener("change", (event) => updateUi({ sortBy: event.target.value }));
  elements.detailForm.addEventListener("submit", handleDetailSave);
  elements.deleteSelectedButton.addEventListener("click", deleteSelectedTask);
  window.addEventListener("beforeunload", flushSave);
}

function handleCreateTask(event) {
  event.preventDefault();

  const title = elements.taskTitle.value.trim();
  if (!title) {
    elements.taskTitle.focus();
    return;
  }

  const task = normalizeTask({
    id: createId(),
    title,
    notes: elements.taskNotes.value.trim(),
    category: elements.taskCategory.value.trim(),
    tags: parseTags(elements.taskTags.value),
    priority: elements.taskPriority.value,
    dueDate: elements.taskDueDate.value || "",
    estimate: parseEstimate(elements.taskEstimate.value),
    flagged: elements.taskFlagged.checked,
    completed: false,
    completedAt: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  state.tasks.unshift(task);
  state.ui.selectedTaskId = task.id;
  elements.taskForm.reset();
  persistAndRender();
}

function handleDetailSave(event) {
  event.preventDefault();
  const task = getSelectedTask();
  if (!task) {
    return;
  }

  task.title = elements.detailTitle.value.trim() || task.title;
  task.notes = elements.detailNotes.value.trim();
  task.category = elements.detailCategory.value.trim();
  task.tags = parseTags(elements.detailTags.value);
  task.priority = normalizePriority(elements.detailPriority.value);
  task.dueDate = elements.detailDueDate.value || "";
  task.estimate = parseEstimate(elements.detailEstimate.value);
  task.flagged = elements.detailFlagged.checked;
  task.updatedAt = new Date().toISOString();

  persistAndRender();
}

function deleteSelectedTask() {
  if (!state.ui.selectedTaskId) {
    return;
  }

  state.tasks = state.tasks.filter((task) => task.id !== state.ui.selectedTaskId);
  state.ui.selectedTaskId = null;
  persistAndRender();
}

function handleViewSwitch(event) {
  const button = event.target.closest("[data-view]");
  if (!button) {
    return;
  }

  updateUi({ view: button.dataset.view });
}

function updateUi(patch) {
  state.ui = { ...state.ui, ...patch };
  persistAndRender();
}

function toggleDensity() {
  state.ui.compact = !state.ui.compact;
  document.body.classList.toggle("compact", state.ui.compact);
  persistAndRender();
}

function completeVisibleTasks() {
  const visible = getVisibleTasks();
  const timestamp = new Date().toISOString();

  visible.forEach((task) => {
    task.completed = true;
    task.completedAt = timestamp;
    task.updatedAt = timestamp;
  });

  persistAndRender();
}

function clearCompletedTasks() {
  state.tasks = state.tasks.filter((task) => !task.completed);
  if (!getSelectedTask()) {
    state.ui.selectedTaskId = null;
  }
  persistAndRender();
}

function exportTasks() {
  const payload = {
    exportedAt: new Date().toISOString(),
    tasks: state.tasks,
    ui: state.ui
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `momentum-tasks-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importTasks(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const importedTasks = Array.isArray(parsed.tasks) ? parsed.tasks.map(normalizeTask).filter(Boolean) : [];
      state.tasks = dedupeTasks([...importedTasks, ...state.tasks]);
      state.ui.selectedTaskId = importedTasks[0] ? importedTasks[0].id : state.ui.selectedTaskId;
      persistAndRender();
    } catch (error) {
      alert("The selected file is not a valid Momentum Tasks export.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function render() {
  syncControls();
  renderViewSwitches();
  renderStats();
  renderCategoryFilter();
  renderTaskList();
  renderDetailPanel();
}

function syncControls() {
  elements.searchInput.value = state.ui.query;
  elements.statusFilter.value = state.ui.status;
  elements.priorityFilter.value = state.ui.priority;
  elements.sortBy.value = state.ui.sortBy;
}

function renderViewSwitches() {
  [...elements.viewSwitches.querySelectorAll("[data-view]")].forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.ui.view);
  });
}

function renderStats() {
  const total = state.tasks.length;
  const completed = state.tasks.filter((task) => task.completed).length;
  const active = total - completed;
  const overdue = state.tasks.filter((task) => isOverdue(task)).length;
  const dueToday = state.tasks.filter((task) => isDueToday(task)).length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;

  const stats = [
    { label: "Total tasks", value: total },
    { label: "Active", value: active },
    { label: "Due today", value: dueToday },
    { label: "Overdue", value: overdue }
  ];

  elements.statsGrid.innerHTML = "";
  stats.forEach((stat) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<span>${stat.label}</span><strong>${stat.value}</strong>`;
    elements.statsGrid.appendChild(card);
  });

  elements.completionLabel.textContent = `${completionRate}%`;
  elements.completionBar.style.width = `${completionRate}%`;
}

function renderCategoryFilter() {
  const categories = [...new Set(state.tasks.map((task) => task.category).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  const current = state.ui.category;

  elements.categoryFilter.innerHTML = `<option value="all">All categories</option>`;
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.categoryFilter.appendChild(option);
  });

  if (current !== "all" && !categories.includes(current)) {
    state.ui.category = "all";
  }

  elements.categoryFilter.value = state.ui.category;
}

function renderTaskList() {
  const tasks = getVisibleTasks();
  elements.taskList.innerHTML = "";
  elements.resultCount.textContent = `${tasks.length} item${tasks.length === 1 ? "" : "s"}`;
  elements.listHeading.textContent = viewHeading(state.ui.view);

  if (!tasks.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No tasks match the current filters. Adjust the view or add a new task.";
    elements.taskList.appendChild(empty);
    return;
  }

  tasks.forEach((task) => {
    const fragment = elements.taskItemTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".task-card");
    const checkbox = fragment.querySelector(".task-toggle");
    const title = fragment.querySelector(".task-title");
    const notes = fragment.querySelector(".task-notes");
    const meta = fragment.querySelector(".task-meta");
    const flagButton = fragment.querySelector(".flag-button");
    const editButton = fragment.querySelector(".edit-button");
    const deleteButton = fragment.querySelector(".delete-button");

    card.classList.toggle("selected", task.id === state.ui.selectedTaskId);
    card.classList.toggle("completed", task.completed);
    checkbox.checked = task.completed;
    title.textContent = task.title;
    title.classList.toggle("done", task.completed);
    notes.textContent = task.notes || "No notes added.";
    flagButton.classList.toggle("active", task.flagged);
    flagButton.textContent = task.flagged ? "Pinned" : "Pin";

    buildTaskMeta(task).forEach((item) => {
      const pill = document.createElement("span");
      pill.className = `meta-pill ${item.className}`.trim();
      pill.textContent = item.label;
      meta.appendChild(pill);
    });

    checkbox.addEventListener("change", () => toggleTask(task.id));
    flagButton.addEventListener("click", () => toggleFlag(task.id));
    editButton.addEventListener("click", () => selectTask(task.id));
    deleteButton.addEventListener("click", () => deleteTask(task.id));
    card.addEventListener("click", (event) => {
      if (event.target.closest("button") || event.target.closest(".check-wrap")) {
        return;
      }
      selectTask(task.id);
    });

    elements.taskList.appendChild(fragment);
  });
}

function renderDetailPanel() {
  const task = getSelectedTask();
  if (!task) {
    elements.detailEmpty.classList.remove("hidden");
    elements.detailForm.classList.add("hidden");
    return;
  }

  elements.detailEmpty.classList.add("hidden");
  elements.detailForm.classList.remove("hidden");
  elements.detailTitle.value = task.title;
  elements.detailNotes.value = task.notes;
  elements.detailCategory.value = task.category;
  elements.detailTags.value = task.tags.join(", ");
  elements.detailPriority.value = task.priority;
  elements.detailDueDate.value = task.dueDate;
  elements.detailEstimate.value = task.estimate || "";
  elements.detailFlagged.checked = task.flagged;
  elements.detailMeta.innerHTML = [
    `Created: ${formatDateTime(task.createdAt)}`,
    `Updated: ${formatDateTime(task.updatedAt)}`,
    `Completed: ${task.completedAt ? formatDateTime(task.completedAt) : "Not yet"}`,
    `Storage key: ${task.id.slice(0, 8)}`
  ].map((item) => `<span>${item}</span>`).join("");
}

function toggleTask(taskId) {
  const task = findTask(taskId);
  if (!task) {
    return;
  }

  const timestamp = new Date().toISOString();
  task.completed = !task.completed;
  task.completedAt = task.completed ? timestamp : "";
  task.updatedAt = timestamp;
  persistAndRender();
}

function toggleFlag(taskId) {
  const task = findTask(taskId);
  if (!task) {
    return;
  }

  task.flagged = !task.flagged;
  task.updatedAt = new Date().toISOString();
  persistAndRender();
}

function selectTask(taskId) {
  state.ui.selectedTaskId = taskId;
  persistAndRender();
}

function deleteTask(taskId) {
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  if (state.ui.selectedTaskId === taskId) {
    state.ui.selectedTaskId = null;
  }
  persistAndRender();
}

function getVisibleTasks() {
  return [...state.tasks]
    .filter(matchesView)
    .filter(matchesQuery)
    .filter(matchesStatus)
    .filter(matchesPriority)
    .filter(matchesCategory)
    .sort(compareTasks(state.ui.sortBy));
}

function matchesView(task) {
  if (state.ui.view === "today") {
    return isDueToday(task) && !task.completed;
  }
  if (state.ui.view === "upcoming") {
    return Boolean(task.dueDate) && !isOverdue(task) && !isDueToday(task) && !task.completed;
  }
  if (state.ui.view === "flagged") {
    return task.flagged;
  }
  if (state.ui.view === "completed") {
    return task.completed;
  }
  return true;
}

function matchesQuery(task) {
  const query = state.ui.query.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return [task.title, task.notes, task.category, task.tags.join(" ")]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function matchesStatus(task) {
  if (state.ui.status === "active") {
    return !task.completed;
  }
  if (state.ui.status === "completed") {
    return task.completed;
  }
  return true;
}

function matchesPriority(task) {
  return state.ui.priority === "all" ? true : task.priority === state.ui.priority;
}

function matchesCategory(task) {
  return state.ui.category === "all" ? true : task.category === state.ui.category;
}

function compareTasks(sortBy) {
  const priorityRank = { critical: 4, high: 3, medium: 2, low: 1 };

  return (left, right) => {
    if (sortBy === "dueSoon") {
      return sortDate(left.dueDate, right.dueDate) || right.createdAt.localeCompare(left.createdAt);
    }
    if (sortBy === "priorityHigh") {
      return priorityRank[right.priority] - priorityRank[left.priority] || sortDate(left.dueDate, right.dueDate);
    }
    if (sortBy === "createdNewest") {
      return right.createdAt.localeCompare(left.createdAt);
    }
    if (sortBy === "alphabetical") {
      return left.title.localeCompare(right.title);
    }

    return (
      Number(right.flagged) - Number(left.flagged) ||
      Number(isOverdue(right)) - Number(isOverdue(left)) ||
      Number(left.completed) - Number(right.completed) ||
      priorityRank[right.priority] - priorityRank[left.priority] ||
      sortDate(left.dueDate, right.dueDate) ||
      right.createdAt.localeCompare(left.createdAt)
    );
  };
}

function sortDate(left, right) {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }
  return left.localeCompare(right);
}

function buildTaskMeta(task) {
  const meta = [
    { label: capitalize(task.priority), className: `priority-${task.priority}` }
  ];

  if (task.category) {
    meta.push({ label: task.category, className: "" });
  }
  if (task.dueDate) {
    meta.push({
      label: isOverdue(task) ? `Overdue ${formatDate(task.dueDate)}` : `Due ${formatDate(task.dueDate)}`,
      className: isOverdue(task) ? "overdue" : ""
    });
  }
  if (task.estimate) {
    meta.push({ label: `${task.estimate} min`, className: "" });
  }
  if (task.tags.length) {
    task.tags.slice(0, 3).forEach((tag) => meta.push({ label: `#${tag}`, className: "" }));
  }

  return meta;
}

function normalizeTask(task) {
  if (!task || typeof task !== "object") {
    return null;
  }

  const title = String(task.title || "").trim();
  if (!title) {
    return null;
  }

  return {
    id: String(task.id || createId()),
    title,
    notes: String(task.notes || "").trim(),
    category: String(task.category || "").trim(),
    tags: Array.isArray(task.tags) ? task.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    priority: normalizePriority(task.priority),
    dueDate: typeof task.dueDate === "string" ? task.dueDate : "",
    estimate: parseEstimate(task.estimate),
    flagged: Boolean(task.flagged),
    completed: Boolean(task.completed),
    completedAt: typeof task.completedAt === "string" ? task.completedAt : "",
    createdAt: typeof task.createdAt === "string" && task.createdAt ? task.createdAt : new Date().toISOString(),
    updatedAt: typeof task.updatedAt === "string" && task.updatedAt ? task.updatedAt : new Date().toISOString()
  };
}

function normalizeUi(ui) {
  return {
    selectedTaskId: typeof ui.selectedTaskId === "string" ? ui.selectedTaskId : null,
    view: ["all", "today", "upcoming", "flagged", "completed"].includes(ui.view) ? ui.view : "all",
    query: typeof ui.query === "string" ? ui.query : "",
    status: ["all", "active", "completed"].includes(ui.status) ? ui.status : "all",
    priority: ["all", "low", "medium", "high", "critical"].includes(ui.priority) ? ui.priority : "all",
    category: typeof ui.category === "string" ? ui.category : "all",
    sortBy: ["smart", "dueSoon", "priorityHigh", "createdNewest", "alphabetical"].includes(ui.sortBy) ? ui.sortBy : "smart",
    compact: Boolean(ui.compact)
  };
}

function normalizePriority(priority) {
  return ["low", "medium", "high", "critical"].includes(priority) ? priority : "medium";
}

function parseTags(input) {
  return String(input || "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function parseEstimate(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isDueToday(task) {
  return Boolean(task.dueDate) && task.dueDate === todayKey();
}

function isOverdue(task) {
  return Boolean(task.dueDate) && !task.completed && task.dueDate < todayKey();
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) {
    return "No date";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  if (!value) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function findTask(taskId) {
  return state.tasks.find((task) => task.id === taskId) || null;
}

function getSelectedTask() {
  return findTask(state.ui.selectedTaskId);
}

function dedupeTasks(tasks) {
  const seen = new Set();
  return tasks.filter((task) => {
    if (!task || seen.has(task.id)) {
      return false;
    }
    seen.add(task.id);
    return true;
  });
}

function viewHeading(view) {
  const headings = {
    all: "All tasks",
    today: "Due today",
    upcoming: "Upcoming work",
    flagged: "Flagged priorities",
    completed: "Completed tasks"
  };
  return headings[view] || "All tasks";
}

function persistAndRender() {
  scheduleSave();
  render();
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    flushSave();
  }, SAVE_DELAY);
}

function flushSave() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    tasks: state.tasks,
    ui: state.ui
  }));
}
