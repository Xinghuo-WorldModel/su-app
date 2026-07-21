const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

const KIMI_API_KEY = "sk-BFd6n9N1Y3zMD5W8ZfCDaIo81tYPrPB4b7AwV242yfflSKNZ";
const KIMI_BASE_URL = "https://api.moonshot.cn/v1";
const KIMI_MODEL = "moonshot-v1-32k";

const DATA_DIR = path.join(__dirname, "data");
const KB_FILE = path.join(DATA_DIR, "knowledge.json");
const PROFILE_FILE = path.join(DATA_DIR, "profile.json");
const CHAT_FILE = path.join(DATA_DIR, "chat_history.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(KB_FILE)) fs.writeFileSync(KB_FILE, "[]");
if (!fs.existsSync(PROFILE_FILE)) fs.writeFileSync(PROFILE_FILE, "{}");
if (!fs.existsSync(CHAT_FILE)) fs.writeFileSync(CHAT_FILE, "[]");
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function getKnowledge() {
  const raw = fs.readFileSync(KB_FILE, "utf-8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}
function saveKnowledge(data) {
  fs.writeFileSync(KB_FILE, JSON.stringify(data, null, 2));
}
function getProfile() {
  const raw = fs.readFileSync(PROFILE_FILE, "utf-8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}
function saveProfile(data) {
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(data, null, 2));
}
function getChatHistory() {
  const raw = fs.readFileSync(CHAT_FILE, "utf-8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}
function saveChatHistory(data) {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(data, null, 2));
}

const SYSTEM_PROMPT = `你是一位专业、温暖的恋爱顾问。你的目标是帮助用户推进和维护与心仪对象的关系。

核心原则：
1. 始终以"推进关系、维护关系"为导向，绝不给出可能破坏关系的建议
2. 充分考虑对方的感受和边界，避免任何 PUA 或过度追求的建议
3. 基于用户提供的具体信息给出个性化、可操作的建议
4. 适时提醒用户关注自身成长，保持健康的心态
5. 如果用户描述的情况暗示对方不感兴趣，温和地帮助用户认清现实

以下是你掌握的关于用户心仪对象的信息：
{KNOWLEDGE}

请基于以上信息，为用户提供贴心、具体的建议。回答要自然、有温度，像一个懂你的朋友在和你聊天。`;

function buildKnowledgeContext() {
  const entries = getKnowledge();
  const profile = getProfile();

  let parts = [];
  if (profile.name) {
    parts.push(`[基础档案] 名字: ${profile.name}`);
    if (profile.age) parts.push(`[基础档案] 年龄: ${profile.age}`);
    if (profile.occupation) parts.push(`[基础档案] 职业: ${profile.occupation}`);
    if (profile.hobbies) parts.push(`[基础档案] 兴趣爱好: ${profile.hobbies}`);
    if (profile.personality) parts.push(`[基础档案] 性格特点: ${profile.personality}`);
    if (profile.notes) parts.push(`[基础档案] 备注: ${profile.notes}`);
  }

  const categoryMap = { profile: "基础信息", event: "关系事件", chat: "聊天记录", preference: "偏好/雷区" };
  for (const entry of entries) {
    const label = categoryMap[entry.category] || entry.category;
    parts.push(`[${label}] ${entry.content}`);
  }

  if (parts.length === 0) {
    return "（暂无录入信息，请提醒用户可以在知识库中添加心仪对象的相关信息，这样你能给出更精准的建议）";
  }
  return parts.join("\n");
}

// Chat API - streaming (text)
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  // 从文件读取完整历史
  const chatHistory = getChatHistory();
  chatHistory.push({ role: "user", content: message });
  saveChatHistory(chatHistory);

  const knowledgeContext = buildKnowledgeContext();
  const systemPrompt = SYSTEM_PROMPT.replace("{KNOWLEDGE}", knowledgeContext);

  // 发给 LLM 时带上所有历史作为上下文
  const messages = [{ role: "system", content: systemPrompt }, ...chatHistory];

  await streamLLMResponse(res, messages);
});

// Chat API - with image
app.post("/api/chat/image", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });

  const userText = req.body.message || "请分析这张图片";
  const base64 = req.file.buffer.toString("base64");
  const mimeType = req.file.mimetype || "image/jpeg";

  const chatHistory = getChatHistory();
  chatHistory.push({ role: "user", content: `[图片] ${userText}` });
  saveChatHistory(chatHistory);

  const knowledgeContext = buildKnowledgeContext();
  const systemPrompt = SYSTEM_PROMPT.replace("{KNOWLEDGE}", knowledgeContext);

  // 构建带图片的消息（只在最后一条用户消息里带图）
  const historyMessages = chatHistory.slice(0, -1);
  const messages = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
      ],
    },
  ];

  await streamLLMResponse(res, messages);
});

// Chat - edit message and regenerate
app.post("/api/chat/edit", async (req, res) => {
  const { messageIndex, newContent } = req.body;

  const chatHistory = getChatHistory();
  if (messageIndex < 0 || messageIndex >= chatHistory.length) {
    return res.status(400).json({ error: "Invalid index" });
  }

  // 截断到编辑位置，替换内容
  const truncated = chatHistory.slice(0, messageIndex);
  truncated.push({ role: "user", content: newContent });
  saveChatHistory(truncated);

  const knowledgeContext = buildKnowledgeContext();
  const systemPrompt = SYSTEM_PROMPT.replace("{KNOWLEDGE}", knowledgeContext);
  const messages = [{ role: "system", content: systemPrompt }, ...truncated];

  await streamLLMResponse(res, messages);
});

// Chat - regenerate last response
app.post("/api/chat/regenerate", async (req, res) => {
  const chatHistory = getChatHistory();

  // 移除最后一条 assistant 消息
  if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === "assistant") {
    chatHistory.pop();
    saveChatHistory(chatHistory);
  }

  const knowledgeContext = buildKnowledgeContext();
  const systemPrompt = SYSTEM_PROMPT.replace("{KNOWLEDGE}", knowledgeContext);
  const messages = [{ role: "system", content: systemPrompt }, ...chatHistory];

  await streamLLMResponse(res, messages);
});

// Shared streaming helper
async function streamLLMResponse(res, messages) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KIMI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: KIMI_MODEL,
        messages,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      res.write(`data: ${JSON.stringify({ error: err })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            res.write("data: [DONE]\n\n");
          } else {
            try {
              const parsed = JSON.parse(payload);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                fullResponse += content;
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch {}
          }
        }
      }
    }
    // 保存 AI 回复到历史
    if (fullResponse) {
      const history = getChatHistory();
      history.push({ role: "assistant", content: fullResponse });
      saveChatHistory(history);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
}

// Knowledge CRUD
app.get("/api/knowledge", (req, res) => {
  const entries = getKnowledge();
  const { category } = req.query;
  if (category && category !== "all") {
    res.json(entries.filter((e) => e.category === category));
  } else {
    res.json(entries);
  }
});

app.post("/api/knowledge", (req, res) => {
  const { category, content } = req.body;
  const entries = getKnowledge();
  const entry = {
    id: Date.now(),
    category,
    content,
    created_at: new Date().toISOString(),
  };
  entries.unshift(entry);
  saveKnowledge(entries);
  res.json(entry);
});

app.delete("/api/knowledge/:id", (req, res) => {
  let entries = getKnowledge();
  entries = entries.filter((e) => e.id !== parseInt(req.params.id));
  saveKnowledge(entries);
  res.json({ success: true });
});

// Screenshot OCR
app.post("/api/knowledge/screenshot", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });

  const base64 = req.file.buffer.toString("base64");
  const mimeType = req.file.mimetype || "image/jpeg";

  try {
    const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KIMI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: KIMI_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "请分析这张聊天截图，提取关键信息：\n1. 对话摘要\n2. 对方态度（积极/中性/消极）\n3. 值得记录的关键信息\n\n用简洁中文返回。",
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const extracted = data.choices?.[0]?.message?.content || "识别失败";

    const entries = getKnowledge();
    const entry = {
      id: Date.now(),
      category: "chat",
      content: extracted,
      created_at: new Date().toISOString(),
    };
    entries.unshift(entry);
    saveKnowledge(entries);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profile
app.get("/api/profile", (req, res) => {
  res.json(getProfile());
});

app.post("/api/profile", (req, res) => {
  saveProfile(req.body);
  res.json(req.body);
});

// Chat history
app.get("/api/chat/history", (req, res) => {
  res.json(getChatHistory());
});

app.delete("/api/chat/history", (req, res) => {
  saveChatHistory([]);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Su 已启动: http://localhost:${PORT}`);
});
