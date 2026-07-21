# Su

基于个人知识库的AI恋爱顾问，帮你推进关系、维护关系。

用户可以录入心仪对象的信息（文字+聊天截图），AI会基于这些先验信息提供个性化的关系建议。

## 截图

| 对话 | 知识库 | TA的档案 |
| :---: | :---: | :---: |
| ![对话](screenshots/chat2.png) | ![知识库](screenshots/knowledge.png) | ![档案](screenshots/profile.png) |

## 功能

- 💬 AI对话 - 基于知识库的个性化恋爱建议，流式输出
- 📚 知识库 - 录入对象的各种信息，支持分类管理
- 📷 截图识别 - 上传聊天截图自动提取关键信息
- 👤 档案管理 - 记录对象的基础信息
- 🔒 安全检查 - 自动过滤可能破坏关系的建议
- 📱 Android App - Capacitor打包的原生体验

## 技术栈

- Node.js + Express
- Kimi (Moonshot AI) 大模型
- Capacitor (Android)

## 部署

```bash
npm install
npm start
```

## 配置

修改 `server.js` 中的 `KIMI_API_KEY` 为你自己的密钥。

获取方式：https://platform.moonshot.cn
