const STORAGE_KEY = "xbloom_session_token";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const clearSessionBtn = document.getElementById("clearSessionBtn");
const loginStatus = document.getElementById("loginStatus");

const nameInput = document.getElementById("name");
const doseInput = document.getElementById("dose");
const tempInput = document.getElementById("temp");
const grindInput = document.getElementById("grind");
const rpmInput = document.getElementById("rpm");
const ratioInput = document.getElementById("ratio");
const pourRowsContainer = document.getElementById("pourRows");
const addPourBtn = document.getElementById("addPourBtn");
const resetPoursBtn = document.getElementById("resetPoursBtn");
const createBtn = document.getElementById("createBtn");
const createStatus = document.getElementById("createStatus");
const resultLink = document.getElementById("resultLink");
const resultJson = document.getElementById("resultJson");
const refreshRecipesBtn = document.getElementById("refreshRecipesBtn");
const clearRecipesViewBtn = document.getElementById("clearRecipesViewBtn");
const recipesStatus = document.getElementById("recipesStatus");
const recipesJson = document.getElementById("recipesJson");
const deleteRecipeIdInput = document.getElementById("deleteRecipeId");
const deleteRecipeBtn = document.getElementById("deleteRecipeBtn");

function setStatus(el, message, type = "") {
  el.textContent = message;
  el.className = `status ${type}`.trim();
}

function getToken() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

function setToken(token) {
  localStorage.setItem(STORAGE_KEY, token);
}

function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
}

function toNumberOrUndefined(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function createPourRow(volume = "", wait = 0) {
  const row = document.createElement("div");
  row.className = "pour-row";
  row.innerHTML = `
    <input type="number" min="0" step="1" placeholder="حجم الصبة ml" value="${volume}">
    <input type="number" min="0" step="1" placeholder="وقت الانتظار sec" value="${wait}">
    <button type="button" class="danger">حذف</button>
  `;

  const deleteBtn = row.querySelector("button");
  deleteBtn.addEventListener("click", () => {
    row.remove();
  });

  return row;
}

function resetToDefaultRows() {
  pourRowsContainer.innerHTML = "";
  pourRowsContainer.appendChild(createPourRow("", 0));
  pourRowsContainer.appendChild(createPourRow("", 0));
  pourRowsContainer.appendChild(createPourRow("", 0));
}

function getManualPours() {
  const rows = Array.from(pourRowsContainer.querySelectorAll(".pour-row"));
  const pours = [];
  const waits = [];

  for (const row of rows) {
    const inputs = row.querySelectorAll("input");
    const volume = Number(inputs[0]?.value || "");
    const wait = Number(inputs[1]?.value || 0);
    if (!Number.isFinite(volume) || volume <= 0) continue;
    pours.push(volume);
    waits.push(Number.isFinite(wait) && wait >= 0 ? wait : 0);
  }

  return { pours, waits };
}

async function callApi(path, { method = "GET", body, token } = {}) {
  const headers = {
    "Content-Type": "application/json"
  };
  const effectiveToken = token || getToken();
  if (effectiveToken) {
    headers["X-Session-Token"] = effectiveToken;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const message = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data.data;
}

async function handleLogin() {
  setStatus(loginStatus, "جارِ تسجيل الدخول...");
  try {
    const data = await callApi("/login", {
      method: "POST",
      body: {
        email: emailInput.value.trim(),
        password: passwordInput.value
      }
    });
    setToken(data.sessionToken);
    passwordInput.value = "";
    setStatus(loginStatus, "تم تسجيل الدخول بنجاح.", "ok");
    await loadRecipes();
  } catch (error) {
    setStatus(loginStatus, `فشل تسجيل الدخول: ${error.message}`, "err");
  }
}

function renderRecipes(recipes) {
  if (!Array.isArray(recipes) || recipes.length === 0) {
    recipesJson.textContent = JSON.stringify(
      { success: true, recipes: [], message: "لا توجد وصفات حالياً." },
      null,
      2
    );
    return;
  }

  recipesJson.textContent = JSON.stringify(
    {
      success: true,
      recipes: recipes.map((r) => ({
        id: r.id,
        name: r.name,
        doseG: r.doseG,
        ratio: r.ratio,
        brewType: r.brewType,
        shareUrl: r.shareUrl
      }))
    },
    null,
    2
  );
}

async function loadRecipes() {
  setStatus(recipesStatus, "جارِ تحميل الوصفات...");
  try {
    const data = await callApi("/recipes");
    renderRecipes(data.recipes || []);
    setStatus(recipesStatus, "تم تحميل الوصفات.", "ok");
  } catch (error) {
    setStatus(recipesStatus, `تعذر جلب الوصفات: ${error.message}`, "err");
  }
}

async function deleteRecipeById(recipeId) {
  const id = Number(recipeId);
  if (!Number.isFinite(id) || id <= 0) {
    setStatus(recipesStatus, "الرجاء إدخال رقم وصفة صحيح.", "err");
    return;
  }

  const confirmed = window.confirm(`تأكيد حذف الوصفة رقم ${id}؟ لا يمكن التراجع.`);
  if (!confirmed) return;

  setStatus(recipesStatus, `جارِ حذف الوصفة ${id}...`);
  try {
    await callApi(`/recipes/${id}`, { method: "DELETE" });
    setStatus(recipesStatus, `تم حذف الوصفة ${id}.`, "ok");
    await loadRecipes();
  } catch (error) {
    setStatus(recipesStatus, `فشل حذف الوصفة: ${error.message}`, "err");
  }
}

async function handleCreateFromText() {
  setStatus(createStatus, "جارِ إنشاء الوصفة...");
  resultLink.textContent = "";
  resultJson.textContent = "";

  try {
    const { pours, waits } = getManualPours();
    if (pours.length === 0) {
      throw new Error("الرجاء إدخال حجم صبة واحد على الأقل.");
    }

    const data = await callApi("/recipes/from-text", {
      method: "POST",
      body: {
        name: nameInput.value.trim() || undefined,
        dose: toNumberOrUndefined(doseInput.value),
        temp: toNumberOrUndefined(tempInput.value),
        grind: toNumberOrUndefined(grindInput.value),
        rpm: toNumberOrUndefined(rpmInput.value),
        ratio: toNumberOrUndefined(ratioInput.value),
        pourVolumesMl: pours,
        waitSeconds: waits,
        recipeText: ""
      }
    });

    setStatus(createStatus, "تم إنشاء الوصفة وإرجاع رابط المشاركة.", "ok");
    resultLink.innerHTML = `Share URL: <a href="${data.shareUrl}" target="_blank" rel="noreferrer">${data.shareUrl}</a>`;
    resultJson.textContent = JSON.stringify({ success: true, ...data }, null, 2);
    await loadRecipes();
  } catch (error) {
    setStatus(createStatus, `فشل العملية: ${error.message}`, "err");
    resultJson.textContent = JSON.stringify(
      { success: false, error: { message: error.message } },
      null,
      2
    );
  }
}

loginBtn.addEventListener("click", handleLogin);
createBtn.addEventListener("click", handleCreateFromText);
addPourBtn.addEventListener("click", () => {
  pourRowsContainer.appendChild(createPourRow("", 0));
});
resetPoursBtn.addEventListener("click", resetToDefaultRows);
refreshRecipesBtn.addEventListener("click", loadRecipes);
clearRecipesViewBtn.addEventListener("click", () => {
  recipesJson.textContent = "";
  setStatus(recipesStatus, "تم مسح العرض.");
});
deleteRecipeBtn.addEventListener("click", async () => {
  await deleteRecipeById(deleteRecipeIdInput.value);
});
clearSessionBtn.addEventListener("click", () => {
  clearToken();
  setStatus(loginStatus, "تم مسح الجلسة المحلية من المتصفح.");
});

window.addEventListener("keydown", async (event) => {
  if (!(event.ctrlKey && event.key.toLowerCase() === "d")) return;
  if (!recipesJson.textContent) return;
  const id = window.prompt("أدخل رقم recipeId للحذف:");
  if (!id) return;
  await deleteRecipeById(id);
});

if (getToken()) {
  setStatus(loginStatus, "يوجد Session Token محفوظ في المتصفح.", "ok");
  loadRecipes();
}

resetToDefaultRows();
