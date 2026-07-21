// Config - change API_BASE to your server IP when running on phone
const API_BASE = window.location.hostname === "localhost" ? "" : "http://192.168.32.83:3000";

// State
let currentFilter = "all";
let modalCategory = "profile";

// DOM
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const knowledgeList = document.getElementById("knowledgeList");
const addModal = document.getElementById("addModal");
const profileForm = document.getElementById("profileForm");

// Tab navigation
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");

    if (btn.dataset.tab === "knowledge") loadKnowledge();
    if (btn.dataset.tab === "profile") loadProfile();
  });
});

// Chat
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

sendBtn.addEventListener("click", handleSend);

// Image upload in chat
document.getElementById("imageBtn").addEventListener("click", () => {
  document.getElementById("chatImageInput").click();
});

document.getElementById("chatImageInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const welcome = chatMessages.querySelector(".welcome-message");
  if (welcome) welcome.remove();

  const userText = chatInput.value.trim() || "请帮我分析这张聊天截图";
  appendMessage("user", `[图片] ${userText}`);
  chatInput.value = "";
  chatInput.style.height = "auto";

  const assistantEl = appendMessage("assistant", "");
  assistantEl.classList.add("typing-indicator");
  sendBtn.disabled = true;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("message", userText);

  try {
    const response = await fetch(API_BASE + "/api/chat/image", { method: "POST", body: formData });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";
    assistantEl.classList.remove("typing-indicator");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.content) {
              fullResponse += parsed.content;
              assistantEl.textContent = fullResponse;
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            if (parsed.error) {
              assistantEl.textContent = "出错了: " + parsed.error;
            }
          } catch {}
        }
      }
    }
  } catch {
    assistantEl.classList.remove("typing-indicator");
    assistantEl.textContent = "图片分析失败，请重试";
  }
  sendBtn.disabled = false;
  e.target.value = "";
});

async function handleSend() {
  const message = chatInput.value.trim();
  if (!message) return;

  // Remove welcome
  const welcome = chatMessages.querySelector(".welcome-message");
  if (welcome) welcome.remove();

  // Add user message
  appendMessage("user", message);
  chatInput.value = "";
  chatInput.style.height = "auto";

  // Add assistant placeholder and stream
  const assistantEl = appendMessage("assistant", "");
  assistantEl.classList.add("typing-indicator");
  await streamFromAPI("/api/chat", { message }, assistantEl);
}

function appendMessage(role, content, index) {
  const wrapper = document.createElement("div");
  wrapper.className = `message-wrapper ${role}`;
  wrapper.dataset.index = index !== undefined ? index : getMessageCount();

  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = content;
  wrapper.appendChild(div);

  // Add action buttons
  const actions = document.createElement("div");
  actions.className = "message-actions";
  if (role === "user") {
    actions.innerHTML = `
      <button class="msg-action-btn edit-btn">编辑</button>
      <button class="msg-action-btn resend-btn">重发</button>
    `;
    actions.querySelector(".edit-btn").addEventListener("click", () => handleEdit(wrapper));
    actions.querySelector(".resend-btn").addEventListener("click", () => handleResend(wrapper));
  } else {
    actions.innerHTML = `<button class="msg-action-btn regen-btn">重新生成</button>`;
    actions.querySelector(".regen-btn").addEventListener("click", () => handleRegenerate());
  }
  wrapper.appendChild(actions);

  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function getMessageCount() {
  return chatMessages.querySelectorAll(".message-wrapper").length;
}

function handleEdit(wrapper) {
  const msgEl = wrapper.querySelector(".message");
  const oldContent = msgEl.textContent;
  const input = document.createElement("textarea");
  input.className = "edit-input";
  input.value = oldContent;
  input.style.cssText = "width:100%;border:1px solid var(--pink);border-radius:12px;padding:10px;font-size:15px;resize:none;outline:none;font-family:inherit;";
  msgEl.replaceWith(input);
  input.focus();

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:8px;margin-top:6px;";
  btnRow.innerHTML = `<button class="btn btn-primary" style="padding:6px 16px;font-size:13px;">确认</button><button class="btn btn-ghost" style="padding:6px 16px;font-size:13px;">取消</button>`;
  wrapper.querySelector(".message-actions").replaceWith(btnRow);

  btnRow.children[0].addEventListener("click", async () => {
    const newContent = input.value.trim();
    if (!newContent) return;
    const index = parseInt(wrapper.dataset.index);

    // Remove all messages from this point onwards in the UI
    let sibling = wrapper.nextElementSibling;
    while (sibling) {
      const next = sibling.nextElementSibling;
      sibling.remove();
      sibling = next;
    }

    // Replace input with message bubble
    const newMsg = document.createElement("div");
    newMsg.className = "message user";
    newMsg.textContent = newContent;
    input.replaceWith(newMsg);
    btnRow.remove();

    // Re-add actions
    const actions = document.createElement("div");
    actions.className = "message-actions";
    actions.innerHTML = `<button class="msg-action-btn edit-btn">编辑</button><button class="msg-action-btn resend-btn">重发</button>`;
    actions.querySelector(".edit-btn").addEventListener("click", () => handleEdit(wrapper));
    actions.querySelector(".resend-btn").addEventListener("click", () => handleResend(wrapper));
    wrapper.appendChild(actions);

    // Call edit API and stream new response
    const assistantEl = appendMessage("assistant", "", index + 1);
    assistantEl.classList.add("typing-indicator");
    await streamFromAPI("/api/chat/edit", { messageIndex: index, newContent }, assistantEl);
  });

  btnRow.children[1].addEventListener("click", () => {
    const newMsg = document.createElement("div");
    newMsg.className = "message user";
    newMsg.textContent = oldContent;
    input.replaceWith(newMsg);
    const actions = document.createElement("div");
    actions.className = "message-actions";
    actions.innerHTML = `<button class="msg-action-btn edit-btn">编辑</button><button class="msg-action-btn resend-btn">重发</button>`;
    actions.querySelector(".edit-btn").addEventListener("click", () => handleEdit(wrapper));
    actions.querySelector(".resend-btn").addEventListener("click", () => handleResend(wrapper));
    btnRow.replaceWith(actions);
  });
}

function handleResend(wrapper) {
  const msgEl = wrapper.querySelector(".message");
  const content = msgEl.textContent;
  const index = parseInt(wrapper.dataset.index);

  // Remove all messages after this one
  let sibling = wrapper.nextElementSibling;
  while (sibling) {
    const next = sibling.nextElementSibling;
    sibling.remove();
    sibling = next;
  }

  // Stream new response
  const assistantEl = appendMessage("assistant", "", index + 1);
  assistantEl.classList.add("typing-indicator");
  streamFromAPI("/api/chat/edit", { messageIndex: index, newContent: content }, assistantEl);
}

async function handleRegenerate() {
  // Remove last assistant message from UI
  const wrappers = chatMessages.querySelectorAll(".message-wrapper");
  const last = wrappers[wrappers.length - 1];
  if (last && last.classList.contains("assistant")) {
    last.remove();
  }

  const assistantEl = appendMessage("assistant", "");
  assistantEl.classList.add("typing-indicator");
  await streamFromAPI("/api/chat/regenerate", {}, assistantEl);
}

async function streamFromAPI(url, body, assistantEl) {
  sendBtn.disabled = true;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";
    assistantEl.classList.remove("typing-indicator");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.content) {
              fullResponse += parsed.content;
              assistantEl.textContent = fullResponse;
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            if (parsed.error) {
              assistantEl.textContent = "出错了: " + parsed.error;
            }
          } catch {}
        }
      }
    }
  } catch {
    assistantEl.classList.remove("typing-indicator");
    assistantEl.textContent = "网络错误，请重试";
  }
  sendBtn.disabled = false;
}

// Knowledge
document.querySelectorAll("#tab-knowledge .filter-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#tab-knowledge .filter-row .filter-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.dataset.category;
    loadKnowledge();
  });
});

document.getElementById("addKnowledgeBtn").addEventListener("click", () => {
  addModal.classList.add("show");
});

document.getElementById("addScreenshotBtn").addEventListener("click", () => {
  document.getElementById("screenshotInput").click();
});

document.getElementById("screenshotInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(API_BASE + "/api/knowledge/screenshot", { method: "POST", body: formData });
    if (res.ok) {
      alert("截图已识别并保存到知识库！");
      loadKnowledge();
    } else {
      alert("识别失败，请重试");
    }
  } catch {
    alert("网络错误");
  }
  e.target.value = "";
});

document.getElementById("modalCancel").addEventListener("click", () => {
  addModal.classList.remove("show");
});

document.querySelector(".modal-overlay").addEventListener("click", () => {
  addModal.classList.remove("show");
});

// Modal category select
document.querySelectorAll(".category-select .filter-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".category-select .filter-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    modalCategory = chip.dataset.value;
  });
});

document.getElementById("modalConfirm").addEventListener("click", async () => {
  const content = document.getElementById("modalContent").value.trim();
  if (!content) return;

  try {
    await fetch(API_BASE + "/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: modalCategory, content }),
    });
    document.getElementById("modalContent").value = "";
    addModal.classList.remove("show");
    loadKnowledge();
  } catch {
    alert("保存失败");
  }
});

async function loadKnowledge() {
  try {
    const res = await fetch(`/api/knowledge?category=${currentFilter}`);
    const entries = await res.json();
    renderKnowledge(entries);
  } catch {}
}

function renderKnowledge(entries) {
  if (entries.length === 0) {
    knowledgeList.innerHTML = '<div class="empty-state">暂无记录，点击上方按钮添加</div>';
    return;
  }

  const categoryMap = { profile: "基础信息", event: "事件", chat: "聊天", preference: "偏好/雷区" };
  knowledgeList.innerHTML = entries.map((e) => `
    <div class="knowledge-card">
      <div class="knowledge-card-header">
        <span class="category-badge">${categoryMap[e.category] || e.category}</span>
        <button class="delete-btn" onclick="deleteKnowledge(${e.id})">🗑</button>
      </div>
      <div class="knowledge-card-content">${escapeHtml(e.content)}</div>
      <div class="knowledge-card-date">${new Date(e.created_at).toLocaleDateString("zh-CN")}</div>
    </div>
  `).join("");
}

async function deleteKnowledge(id) {
  if (!confirm("确定删除？")) return;
  await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
  loadKnowledge();
}

// Profile
profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    name: document.getElementById("profileName").value,
    age: document.getElementById("profileAge").value,
    occupation: document.getElementById("profileOccupation").value,
    hobbies: document.getElementById("profileHobbies").value,
    personality: document.getElementById("profilePersonality").value,
    notes: document.getElementById("profileNotes").value,
  };
  try {
    await fetch(API_BASE + "/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    alert("档案已保存！");
  } catch {
    alert("保存失败");
  }
});

async function loadProfile() {
  try {
    const res = await fetch(API_BASE + "/api/profile");
    const data = await res.json();
    document.getElementById("profileName").value = data.name || "";
    document.getElementById("profileAge").value = data.age || "";
    document.getElementById("profileOccupation").value = data.occupation || "";
    document.getElementById("profileHobbies").value = data.hobbies || "";
    document.getElementById("profilePersonality").value = data.personality || "";
    document.getElementById("profileNotes").value = data.notes || "";
  } catch {}
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Init
loadProfile();
loadChatHistory();

async function loadChatHistory() {
  try {
    const res = await fetch(API_BASE + "/api/chat/history");
    const history = await res.json();
    if (history.length > 0) {
      const welcome = chatMessages.querySelector(".welcome-message");
      if (welcome) welcome.remove();
      history.forEach((msg, i) => {
        appendMessage(msg.role, msg.content, i);
      });
    }
  } catch {}
}
