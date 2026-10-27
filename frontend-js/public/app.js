const API = "/api/todos";
const PRIORITY_LABELS = { low: "Basse", medium: "Moyenne", high: "Haute" };
const EMPTY_TEXTS = {
  all: "Aucune tâche pour le moment. Ajoutez-en une !",
  active: "Rien à faire, bravo ! 🎉",
  done: "Aucune tâche terminée.",
};

const $ = (id) => document.getElementById(id);
const els = {
  form: $("form"), title: $("title"), description: $("description"), priority: $("priority"), due: $("due"),
  details: $("details"), toggleDetails: $("toggle-details"),
  search: $("search"), list: $("list"), empty: $("empty"), emptyText: $("empty-text"),
  error: $("error"), count: $("count"), clear: $("clear"), theme: $("theme"), progress: $("progress"),
  statTotal: $("stat-total"), statActive: $("stat-active"), statDone: $("stat-done"),
  dialog: $("edit-dialog"), editForm: $("edit-form"), editTitle: $("edit-title"),
  editDescription: $("edit-description"), editPriority: $("edit-priority"), editDue: $("edit-due"),
  editCancel: $("edit-cancel"),
};

const state = { todos: [], filter: "all", query: "", editingId: null };

async function request(url, options) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return res.status === 204 ? null : res.json();
}

// Exécute une action API puis recharge la liste ; affiche l'erreur éventuelle
async function run(action) {
  els.error.textContent = "";
  try {
    await action();
    state.todos = await request(API);
    render();
  } catch (err) {
    els.error.textContent = err.message;
  }
}

const patch = (id, body) => request(`${API}/${id}`, { method: "PATCH", body: JSON.stringify(body) });

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function chip(text, cls = "") {
  const span = document.createElement("span");
  span.className = `chip ${cls}`.trim();
  span.textContent = text;
  return span;
}

function visibleTodos() {
  const q = state.query.toLowerCase();
  return state.todos.filter((t) => {
    if (state.filter === "active" && t.done) return false;
    if (state.filter === "done" && !t.done) return false;
    return !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });
}

function renderTodo(todo) {
  const li = document.createElement("li");
  li.className = `card todo${todo.done ? " done" : ""}`;
  li.dataset.priority = todo.priority;

  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "check";
  check.checked = todo.done;
  check.setAttribute("aria-label", "Terminée");
  check.addEventListener("change", () => run(() => patch(todo.id, { done: check.checked })));

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
  del.addEventListener("click", () => run(() => request(`${API}/${todo.id}`, { method: "DELETE" })));
  actions.append(edit, del);

  li.append(check, body, actions);
  return li;
}

function render() {
  const total = state.todos.length;
  const done = state.todos.filter((t) => t.done).length;
  els.statTotal.textContent = total;
  els.statActive.textContent = total - done;
  els.statDone.textContent = done;
  els.progress.style.width = total ? `${(done / total) * 100}%` : "0";
  els.count.textContent = `${total - done} tâche${total - done > 1 ? "s" : ""} restante${total - done > 1 ? "s" : ""}`;
  els.clear.hidden = done === 0;

  const todos = visibleTodos();
  els.list.replaceChildren(...todos.map(renderTodo));
  els.empty.hidden = todos.length > 0;
  els.emptyText.textContent = state.query ? "Aucun résultat." : EMPTY_TEXTS[state.filter];
}

function openEdit(todo) {
  state.editingId = todo.id;
  els.editTitle.value = todo.title;
  els.editDescription.value = todo.description;
  els.editPriority.value = todo.priority;
  els.editDue.value = todo.due_date || "";
  els.dialog.showModal();
}

// Événements
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = els.title.value.trim();
  if (!title) return;
  const body = {
    title,
    description: els.description.value,
    priority: els.priority.value,
    due_date: els.due.value || null,
  };
  run(async () => {
    await request(API, { method: "POST", body: JSON.stringify(body) });
    els.form.reset();
  });
});

els.toggleDetails.addEventListener("click", () => {
  const open = els.details.classList.toggle("open");
  els.toggleDetails.setAttribute("aria-expanded", String(open));
  els.toggleDetails.textContent = open ? "− Masquer les détails" : "+ Ajouter des détails";
});

els.search.addEventListener("input", () => { state.query = els.search.value.trim(); render(); });

document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    state.filter = tab.dataset.filter;
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
    render();
  })
);

els.clear.addEventListener("click", () => {
  if (!confirm("Supprimer toutes les tâches terminées ?")) return;
  const ids = state.todos.filter((t) => t.done).map((t) => t.id);
  run(() => Promise.all(ids.map((id) => request(`${API}/${id}`, { method: "DELETE" }))));
});

els.editForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = els.editTitle.value.trim();
  if (!title) return;
  const id = state.editingId;
  els.dialog.close();
  run(() => patch(id, {
    title,
    description: els.editDescription.value,
    priority: els.editPriority.value,
    due_date: els.editDue.value || null,
  }));
});
els.editCancel.addEventListener("click", () => els.dialog.close());

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
  els.theme.textContent = theme === "dark" ? "☀️" : "🌙";
}
els.theme.addEventListener("click", () =>
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")
);
applyTheme(document.documentElement.dataset.theme);

run(async () => {});
