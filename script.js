// TaskFlow - Supabase version
// Add your Supabase Project URL and Publishable key below.
// Never put a Supabase Secret key in browser code.
const SUPABASE_URL = "https://znnhuojjunokhzhghiek.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3df6UoOIEoSzNBLTiowCqw_3YGzuwY_";

const authSection = document.getElementById("authSection");
const appContainer = document.getElementById("appContainer");
const authForm = document.getElementById("authForm");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const authMessage = document.getElementById("authMessage");
const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const logoutBtn = document.getElementById("logoutBtn");
const studentName = document.getElementById("studentName");

const taskForm = document.getElementById("taskForm");
const showFormBtn = document.getElementById("showFormBtn");
const taskList = document.getElementById("taskList");
const totalTasks = document.getElementById("totalTasks");
const pendingTasks = document.getElementById("pendingTasks");
const completedTasks = document.getElementById("completedTasks");
const taskTitle = document.getElementById("taskTitle");
const taskDescription = document.getElementById("taskDescription");
const taskDate = document.getElementById("taskDate");
const taskPriority = document.getElementById("taskPriority");
const filterButtons = document.querySelectorAll(".filter-btn");
const searchTasks = document.getElementById("searchTasks");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const saveButton = taskForm.querySelector("button[type='submit']");
const currentDate = document.getElementById("currentDate");

let authMode = "login";
let currentUser = null;
let tasks = [];
let currentFilter = "all";
let editingTaskId = null;
let supabaseClient = null;

function showLoginPage() {
  authSection.classList.remove("hidden");
  appContainer.classList.add("hidden");
}
function showTaskManager(user) {
  currentUser = user;

  authSection.classList.add("hidden");
  appContainer.classList.remove("hidden");

  studentName.textContent =
    user.user_metadata?.name || user.email || "Student";

  authMessage.textContent = "";
  authForm.reset();

  loadTasks();
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === "signup";
  loginTab.classList.toggle("active", !isSignup);
  signupTab.classList.toggle("active", isSignup);
  authName.classList.toggle("hidden", !isSignup);
  authName.required = isSignup;
  authSubmit.textContent = isSignup ? "Create Account" : "Login";
  authMessage.textContent = "";
}

loginTab.addEventListener("click", () => setAuthMode("login"));
signupTab.addEventListener("click", () => setAuthMode("signup"));

function showAuthError(error) {
  authMessage.textContent = error?.message || "Something went wrong. Please try again.";
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) {
    authMessage.textContent = "Please add your Supabase URL and Publishable key in script.js first.";
    return;
  }

  const email = authEmail.value.trim().toLowerCase();
  const password = authPassword.value;
  authSubmit.disabled = true;
  authMessage.textContent = authMode === "signup" ? "Creating account..." : "Logging in...";

  try {
    if (authMode === "signup") {
      const name = authName.value.trim();
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { name } }
      });
      if (error) throw error;

      if (data.session) {
        showTaskManager(data.user);
        authForm.reset();
      } else {
        authMessage.textContent = "Account created. Check your email to confirm, then log in.";
        setAuthMode("login");
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showTaskManager(data.user);
      authForm.reset();
    }
  } catch (error) {
    showAuthError(error);
  } finally {
    authSubmit.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  currentUser = null;
  tasks = [];
  showLoginPage();
});

currentDate.textContent = new Date().toLocaleDateString("en-IN", {
  weekday: "long", day: "numeric", month: "long", year: "numeric"
});
taskDate.value = new Date().toISOString().split("T")[0];

async function loadTasks() {
  if (!currentUser || !supabaseClient) return;
  const { data, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    alert("Could not load tasks: " + error.message);
    return;
  }

  tasks = (data || []).map(row => ({
    id: row.id,
    title: row.title,
    description: row.description || "",
    date: row.due_date,
    priority: row.priority || "Medium",
    completed: Boolean(row.completed)
  }));
  renderTasks();
}

async function saveTaskToDatabase(task, isUpdate = false) {
  if (!currentUser || !supabaseClient) return;

  const row = {
    user_id: currentUser.id,
    title: task.title,
    description: task.description || null,
    due_date: task.date,
    priority: task.priority,
    completed: Boolean(task.completed)
  };

  const result = isUpdate
    ? await supabaseClient.from("tasks").update(row).eq("id", task.id)
    : await supabaseClient.from("tasks").insert(row);

  if (result.error) throw result.error;
}

showFormBtn.addEventListener("click", () => {
  taskForm.classList.toggle("hidden");
  if (!taskForm.classList.contains("hidden")) taskTitle.focus();
});

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const title = taskTitle.value.trim();
  const description = taskDescription.value.trim();
  const date = taskDate.value;
  const priority = taskPriority.value;

  if (!title || !date) {
    alert("Please enter task title and due date.");
    return;
  }

  saveButton.disabled = true;
  try {
    if (editingTaskId !== null) {
      const task = tasks.find(item => item.id === editingTaskId);
      if (!task) return;
      const updated = { ...task, title, description, date, priority };
      await saveTaskToDatabase(updated, true);
      editingTaskId = null;
      saveButton.textContent = "Save Task";
    } else {
      await saveTaskToDatabase({
        title, description, date, priority, completed: false
      });
    }

    taskForm.reset();
    taskDate.value = new Date().toISOString().split("T")[0];
    taskForm.classList.add("hidden");
    await loadTasks();
  } catch (error) {
    alert("Could not save task: " + error.message);
  } finally {
    saveButton.disabled = false;
  }
});

function renderTasks() {
  taskList.innerHTML = "";
  let filteredTasks = tasks;
  const searchValue = searchTasks.value.toLowerCase().trim();

  filteredTasks = filteredTasks.filter(task =>
    task.title.toLowerCase().includes(searchValue)
  );

  if (currentFilter === "pending") filteredTasks = filteredTasks.filter(task => !task.completed);
  if (currentFilter === "completed") filteredTasks = filteredTasks.filter(task => task.completed);

  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  const pending = total - completed;
  totalTasks.textContent = total;
  pendingTasks.textContent = pending;
  completedTasks.textContent = completed;

  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
  progressBar.style.width = progress + "%";
  progressText.textContent = progress + "%";

  if (filteredTasks.length === 0) {
    taskList.innerHTML = `
      <div class="empty-message">
        <h3>No tasks found 🎯</h3>
        <p>Add a new task to get started!</p>
      </div>`;
    return;
  }

  filteredTasks.forEach(task => {
    const card = document.createElement("div");
    card.className = "task-card";
    if (task.completed) card.classList.add("completed");

    const taskInfo = document.createElement("div");
    taskInfo.className = "task-info";
    const title = document.createElement("h3");
    title.textContent = task.title;
    const description = document.createElement("p");
    description.textContent = task.description || "No description";
    const meta = document.createElement("div");
    meta.className = "task-meta";
    const date = document.createElement("span");
    date.textContent = "📅 " + task.date;
    const priority = document.createElement("span");
    priority.className = "priority " + task.priority;
    priority.textContent = task.priority + " Priority";
    meta.append(date, priority);
    taskInfo.append(title, description, meta);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => editTask(task.id));

    const completeBtn = document.createElement("button");
    completeBtn.className = "complete-btn";
    completeBtn.textContent = task.completed ? "Undo" : "Complete";
    completeBtn.addEventListener("click", () => toggleTask(task.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    actions.append(editBtn, completeBtn, deleteBtn);
    card.append(taskInfo, actions);
    taskList.appendChild(card);
  });
}

function editTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  editingTaskId = id;
  taskTitle.value = task.title;
  taskDescription.value = task.description;
  taskDate.value = task.date;
  taskPriority.value = task.priority;
  taskForm.classList.remove("hidden");
  saveButton.textContent = "Update Task";
  taskForm.scrollIntoView({ behavior: "smooth", block: "center" });
  taskTitle.focus();
}

async function toggleTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;
  try {
    await saveTaskToDatabase({ ...task, completed: !task.completed }, true);
    await loadTasks();
  } catch (error) {
    alert("Could not update task: " + error.message);
  }
}

async function deleteTask(id) {
  if (!confirm("Are you sure you want to delete this task?")) return;
  const { error } = await supabaseClient.from("tasks").delete().eq("id", id);
  if (error) {
    alert("Could not delete task: " + error.message);
    return;
  }
  await loadTasks();
}

filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    filterButtons.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
    renderTasks();
  });
});

searchTasks.addEventListener("input", renderTasks);

// Load Supabase JS SDK and restore existing session.
(async function initSupabase() {
  try {
    const { createClient } = await import(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
    );

    supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) throw error;

    if (data.session) {
      showTaskManager(data.session.user);
    } else {
      showLoginPage();
    }

  } catch (error) {
    console.error("Supabase initialization error:", error);
    authMessage.textContent =
      "Supabase error: " + error.message;
    showLoginPage();
  }
})();