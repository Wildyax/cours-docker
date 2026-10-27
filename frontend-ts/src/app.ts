type Priority = "low" | "medium" | "high";
type Filter = "all" | "active" | "done";

interface Todo {
  id: number;
  title: string;
  description: string;
  priority: Priority;
  due_date: string | null;
  done: boolean;
  created_at: string;
}

type TodoPayload = Partial<Pick<Todo, "title" | "description" | "priority" | "due_date" | "done">>;

interface State {
  todos: Todo[];
  filter: Filter;
  query: string;
  editingId: number | null;
}

const API = "/api/todos";
const PRIORITY_LABELS: Record<Priority, string> = { low: "Basse", medium: "Moyenne", high: "Haute" };
const EMPTY_TEXTS: Record<Filter, string> = {
  all: "Aucune tâche pour le moment. Ajoutez-en une !",
  active: "Rien à faire, bravo ! 🎉",
  done: "Aucune tâche terminée.",
};

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Élément #${id} introuvable`);
  return el as T;
}

const els = {
  form: $<HTMLFormElement>("form"),
  title: $<HTMLInputElement>("title"),
  description: $<HTMLTextAreaElement>("description"),
  priority: $<HTMLSelectElement>("priority"),
  due: $<HTMLInputElement>("due"),
  details: $<HTMLDivElement>("details"),
  toggleDetails: $<HTMLButtonElement>("toggle-details"),
  search: $<HTMLInputElement>("search"),
  list: $<HTMLUListElement>("list"),
  empty: $<HTMLDivElement>("empty"),
  emptyText: $<HTMLParagraphElement>("empty-text"),
  error: $<HTMLParagraphElement>("error"),
  count: $<HTMLSpanElement>("count"),
  clear: $<HTMLButtonElement>("clear"),
  theme: $<HTMLButtonElement>("theme"),
  progress: $<HTMLDivElement>("progress"),
  statTotal: $<HTMLElement>("stat-total"),
  statActive: $<HTMLElement>("stat-active"),
  statDone: $<HTMLElement>("stat-done"),
  dialog: $<HTMLDialogElement>("edit-dialog"),
  editForm: $<HTMLFormElement>("edit-form"),
  editTitle: $<HTMLInputElement>("edit-title"),
  editDescription: $<HTMLTextAreaElement>("edit-description"),
  editPriority: $<HTMLSelectElement>("edit-priority"),
  editDue: $<HTMLInputElement>("edit-due"),
  editCancel: $<HTMLButtonElement>("edit-cancel"),
};

const state: State = { todos: [], filter: "all", query: "", editingId: null };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

// Exécute une action API puis recharge la liste ; affiche l'erreur éventuelle
async function run(action: () => Promise<unknown>): Promise<void> {
  els.error.textContent = "";
  try {
    await action();
    state.todos = await request<Todo[]>(API);
    render();
  } catch (err) {
    els.error.textContent = err instanceof Error ? err.message : String(err);
  }
}

const patch = (id: number, body: TodoPayload) =>
  request<Todo>(`${API}/${id}`, { method: "PATCH", body: JSON.stringify(body) });

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function chip(text: string, cls = ""): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = `chip ${cls}`.trim();
  span.textContent = text;
  return span;
}

function visibleTodos(): Todo[] {
  const q = state.query.toLowerCase();
  return state.todos.filter((t) => {
    if (state.filter === "active" && t.done) return false;
    if (state.filter === "done" && !t.done) return false;
    return !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });
}

function renderTodo(todo: Todo): HTMLLIElement {
  const li = document.createElement("li");
  li.className = `card todo${todo.done ? " done" : ""}`;
  li.dataset.priority = todo.priority;

  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "check";
  check.checked = todo.done;
  check.setAttribute("aria-label", "Terminée");
  check.addEventListener("change", () => void run(() => patch(todo.id, { done: check.checked })));

  const body = document.createElement("div");
  const title = document.createElement("div");
  title.className = "title";
  title.textContent = todo.title; // textContent : pas d'injection HTML
  body.append(title);
  if (todo.description) {
    const desc = document.createElement("p");
    desc.className = "desc";
    desc.textContent = todo.description;
    body.append(desc);
  }
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.append(chip(PRIORITY_LABELS[todo.priority], todo.priority));
  if (todo.due_date) {
    const overdue = !todo.done && todo.due_date < todayISO();
    meta.append(chip(`📅 ${formatDate(todo.due_date)}${overdue ? " · en retard" : ""}`, overdue ? "overdue" : ""));
  }
  body.append(meta);

  const actions = document.createElement("div");
  actions.className = "actions";
  const edit = document.createElement("button");
  edit.className = "act";
  edit.textContent = "✏️";
  edit.setAttribute("aria-label", "Modifier");
  edit.addEventListener("click", () => openEdit(todo));
  const del = document.createElement("button");
  del.className = "act del";
  del.textContent = "🗑️";
  del.setAttribute("aria-label", "Supprimer");
  del.addEventListener("click", () => void run(() => request<null>(`${API}/${todo.id}`, { method: "DELETE" })));
  actions.append(edit, del);

  li.append(check, body, actions);
  return li;
}

function render(): void {
  const total = state.todos.length;
  const done = state.todos.filter((t) => t.done).length;
  const remaining = total - done;
  els.statTotal.textContent = String(total);
  els.statActive.textContent = String(remaining);
  els.statDone.textContent = String(done);
  els.progress.style.width = total ? `${(done / total) * 100}%` : "0";
  els.count.textContent = `${remaining} tâche${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}`;
  els.clear.hidden = done === 0;

  const todos = visibleTodos();
  els.list.replaceChildren(...todos.map(renderTodo));
  els.empty.hidden = todos.length > 0;
  els.emptyText.textContent = state.query ? "Aucun résultat." : EMPTY_TEXTS[state.filter];
}

function openEdit(todo: Todo): void {
  state.editingId = todo.id;
  els.editTitle.value = todo.title;
  els.editDescription.value = todo.description;
  els.editPriority.value = todo.priority;
  els.editDue.value = todo.due_date ?? "";
  els.dialog.showModal();
}

// Événements
els.form.addEventListener("submit", (e: SubmitEvent) => {
  e.preventDefault();
  const title = els.title.value.trim();
  if (!title) return;
  const body: TodoPayload = {
    title,
    description: els.description.value,
    priority: els.priority.value as Priority,
    due_date: els.due.value || null,
  };
  void run(async () => {
    await request<Todo>(API, { method: "POST", body: JSON.stringify(body) });
    els.form.reset();
  });
});

els.toggleDetails.addEventListener("click", () => {
  const open = els.details.classList.toggle("open");
  els.toggleDetails.setAttribute("aria-expanded", String(open));
  els.toggleDetails.textContent = open ? "− Masquer les détails" : "+ Ajouter des détails";
});

els.search.addEventListener("input", () => {
  state.query = els.search.value.trim();
  render();
});

const tabs = document.querySelectorAll<HTMLButtonElement>(".tab");
tabs.forEach((tab) =>
  tab.addEventListener("click", () => {
    state.filter = tab.dataset.filter as Filter;
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
    render();
  })
);

els.clear.addEventListener("click", () => {
  if (!confirm("Supprimer toutes les tâches terminées ?")) return;
  const ids = state.todos.filter((t) => t.done).map((t) => t.id);
  void run(() => Promise.all(ids.map((id) => request<null>(`${API}/${id}`, { method: "DELETE" }))));
});

els.editForm.addEventListener("submit", (e: SubmitEvent) => {
  e.preventDefault();
  const title = els.editTitle.value.trim();
  if (!title || state.editingId === null) return;
  const id = state.editingId;
  els.dialog.close();
  void run(() =>
    patch(id, {
      title,
      description: els.editDescription.value,
      priority: els.editPriority.value as Priority,
      due_date: els.editDue.value || null,
    })
  );
});
els.editCancel.addEventListener("click", () => els.dialog.close());

function applyTheme(theme: string): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
  els.theme.textContent = theme === "dark" ? "☀️" : "🌙";
}
els.theme.addEventListener("click", () =>
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")
);
applyTheme(document.documentElement.dataset.theme ?? "light");

void run(async () => {});
