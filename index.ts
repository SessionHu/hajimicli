import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

import readline from 'node:readline/promises';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from "node:path";
import child_process from 'node:child_process';

import type { Content, Chat } from "@google/genai";

// ----------------------------------------------------
// 1. 配置加载与初始化
// ----------------------------------------------------

// 载入 .env 文件中的变量，让ls读取你的配置喵！
dotenv.config({quiet:true});

// 初始化 Gemini 客户端
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  vertexai: Boolean(process.env.VERTEX)
});

/**
 * 喵呜~ 这是一个可爱的函数，用来获取支持反斜杠续行的多行输入喵！
 * @param rl - readline 接口实例喵
 * @param initialPrompt - 第一次显示的提示信息喵
 * @returns 拼接好的用户输入喵
 */
async function getMultilineInput(rl: readline.Interface, initialPrompt: string): Promise<string> {
  let fullInput = '';
  let currentPrompt = initialPrompt;

  while (true) {
    const line = await rl.question(currentPrompt);

    if (line.endsWith('\\')) {
      fullInput += line.slice(0, -1) + '\n'; // 移除反斜杠并添加换行符
      currentPrompt = '| '; // 续行提示符
    } else {
      fullInput += line;
      break; // 没有反斜杠，表示输入结束
    }
  }
  return fullInput;
}

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ? await fs.readFile(process.env.SYSTEM_PROMPT, 'utf8') : ""; // 默认可以为空
  
let modelname = process.env.GEMINI_MODEL || "gemini-2.5-flash"; // 默认使用 flash

function createChat(history?: Content[]) {
  return ai.chats.create({
    model: modelname,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.8,
      maxOutputTokens: 8192,
    },
    history
  });
}

/**
 * 喵呜~ 这是一个小帮手，用来打印加载历史中的最后一条或最后一次对话喵！
 * @param history - 对话历史记录喵
 */
function printLastConversation(history: Content[]): void {
  const lastTwo = history.slice(-2);
  if (
    lastTwo[0] &&
    lastTwo[1] &&
    lastTwo[0].role === 'user' &&
    lastTwo[0].parts &&
    lastTwo[1].role === 'model' &&
    lastTwo[1].parts
  ) {
    console.log(`\n--- 最后一次对话 ---`);
    console.log(`user:\n> ${lastTwo[0].parts.map(p => 'text' in p ? p.text : '').join('')}`);
    console.log(`\nmodel:\n${lastTwo[1].parts.map(p => 'text' in p ? p.text : '').join('')}`);
    console.log(`--------------------`);
  } else if (history.length > 0) {
    const lastEntry = history[history.length - 1];
    console.log(`\n--- 最后一条记录 ---`);
    console.log(
      lastEntry?.role && lastEntry.parts ?
        `${lastEntry.role}:\n${lastEntry.parts.map(p => 'text' in p ? p.text : '').join('')}`
      :
        lastEntry
    );
    console.log(`--------------------`);
  }
}

/**
 * 喵呜~ 这是一个可爱的函数，用来加载保存的聊天历史喵！
 * @param filename - 要加载的文件名喵
 * @param currentChat - 当前的聊天会话喵
 * @returns 新的聊天会话或者原来的会话（如果加载失败）喵
 */
async function loadChatHistory(filename: string, currentChat: Chat): Promise<Chat> {
  try {
    const fileContent = await fs.readFile(filename, 'utf8');
    const history: Content[] = JSON.parse(fileContent);
    const newChat = createChat(history);
    console.log(`\n📂 对话历史已从 ${filename} 加载喵~`);
    printLastConversation(history); // 调用小帮手打印最后对话喵
    return newChat;
  } catch (error) {
    console.error(`\n❌ 加载文件时出错了喵:`, error);
    return currentChat; // 加载失败，返回原来的聊天会话喵
  }
}

/**
 * 压缩聊天记录
 * @param contents - 待压缩的原始记录
 * @returns 压缩后的记录
 */
function minifyChatHistory(contents: Content[]): Content[] {
  const res = new Array<Content>;
  for (const e of contents) {
    const lst = res.pop();
    if (
      lst &&
      lst.role === e.role &&
      lst.parts?.length === 1 && lst.parts.length === e.parts?.length &&
      lst.parts[0] && e.parts[0] &&
      Object.keys(lst.parts[0])[0] === Object.keys(e.parts[0])[0] &&
      lst.parts[0].text && e.parts[0].text
    ) {
      lst.parts[0].text += e.parts[0].text;
      res.push(lst);
    } else
      lst ? res.push(lst, e) : res.push(e);
  }
  return res;
}

/**
 * 使用外部编辑器编辑内容
 */
async function editWithExternalEditor(initcontent?: string, filename = 'prompt.md'): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), '/tmp.'));
  const file = path.join(dir, filename);
  initcontent && await fs.writeFile(file, initcontent, 'utf8');
  child_process.spawnSync(process.env.EDITOR || 'editor', [ file ], {
    stdio: 'inherit'
  });
  const content = await fs.readFile(file, 'utf8').catch(console.warn);
  fs.rm(dir, { recursive: true }).catch(console.warn);
  return content?.trimEnd() || '';
}

// ----------------------------------------------------
// 2. 对话核心逻辑
// ----------------------------------------------------

/**
 * 喵呜~ 这是 CLI 的主函数，负责启动对话循环喵！
 */
async function main(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // 1. 创建聊天会话
  // 使用 ai.chats.create 来启动一个带历史记录的对话喵！
  // ls把 SYSTEM_PROMPT 放到了这里面的 config.systemInstruction 里，
  // 这样模型就会一直保持这个设定啦，超棒的喵！
  let chat = createChat();

  // 2. 打印欢迎信息
  console.log(`\n✨ Hajimi ni Chat CLI`);
  console.log(`模型: ${modelname}`);
  if (SYSTEM_PROMPT) {
    console.log(`系统提示词已设置 (✓)`);
  }
  console.log('`/exit` 或 `/quit` 退出');
  console.log('`/list` 列出所有可用模型');
  console.log('`/model <model_name>` 切换模型');
  console.log('`/clear` 清除历史记录');
  console.log('`/history` 编辑历史记录');
  console.log('`/editor` 使用外部编辑器编辑');
  console.log('`/save <filename>` 保存对话');
  console.log('`/load <filename>` 加载对话');
  console.log(`-----------------------------------`);

  // 3. 循环等待用户输入
  while (true) {
    let userPrompt: string;
    try {
      userPrompt = await getMultilineInput(rl, '\nuser:\n> ');
    } catch (e: any) {
      // 喵~ 检测到用户按下了 Ctrl+D (AbortError), ls 会和 'quit' 一样乖乖退出的喵
      if ('code' in e && e.code === 'ABORT_ERR') {
        rl.close();
        break;
      }
      // 其他 readline 错误，还是抛出去看看是啥问题喵
      throw e;
    }

    if (userPrompt.toLowerCase() === '/exit' || userPrompt.toLowerCase() === '/quit') {
      rl.close();
      break;
    }

    // 喵~ 处理 /model 命令
    else if (userPrompt.toLowerCase().startsWith('/model')) {
      const newModel = userPrompt.split(/\s+/)[1]?.trim();
      if (newModel) {
        modelname = newModel;
        // 重新创建一个带有新模型的聊天会话喵
        chat = createChat(chat.getHistory(true));
        console.log(`\n✨ 模型已切换为: ${modelname} 喵~`);
        continue; // 继续下一次循环，等待用户输入喵
      } else {
        console.log(`\n🤔 喵, 请指定一个模型名称喵, 像这样: /model gemini-2.5-flash`);
        continue; // 继续下一次循环
      }
    }

    // list avaliable models
    else if (userPrompt.toLowerCase() === '/list') {
      console.log();
      for await (const e of await ai.models.list()) {
        console.log(e.name, ':', e.displayName, ':', e.description);
      }
      continue;
    }

    // clear history
    else if (userPrompt.toLowerCase() === '/clear') {
      chat = createChat();
      console.log(`🧹 历史记录已清除喵~`);
      continue; // 继续下一次循环
    }

    // 喵~ 处理 /save 命令
    else if (userPrompt.toLowerCase().startsWith('/save')) {
      const filename = userPrompt.split(/\s+/)[1]?.trim();
      if (filename) {
        try {
          const history = minifyChatHistory(chat.getHistory(true));
          await fs.writeFile(filename, JSON.stringify(history, null, 2));
          console.log(`\n💾 对话历史已保存到 ${filename} 喵~`);
        } catch (error) {
          console.error(`\n❌ 保存文件时出错了喵:`, error);
        }
      } else {
        console.log(`\n🤔 喵, 请指定一个文件名喵, 像这样: /save my_chat.json`);
      }
      continue;
    }

    // 喵~ 处理 /load 命令
    else if (userPrompt.toLowerCase().startsWith('/load')) {
      const filename = userPrompt.split(/\s+/)[1]?.trim();
      if (filename) {
        chat = await loadChatHistory(filename, chat);
      } else {
        console.log(`\n🤔 喵, 请指定一个文件名喵, 像这样: /load my_chat.json`);
      }
      continue;
    }

    // edit history
    else if (userPrompt.toLowerCase() === '/history') {
      chat = createChat(JSON.parse(await editWithExternalEditor(JSON.stringify(minifyChatHistory(chat.getHistory(true)), null, 2), 'history.json')))
      continue;
    }

    // edit with external editor
    else if (userPrompt.toLowerCase() === '/editor') {
      console.log(userPrompt = await editWithExternalEditor());
    }

    try {
      // 4. 发送消息并获取回复
      // 使用 chat.sendMessage()，它会自动把之前的聊天记录也传过去，
      // 这样模型就能记住上下文，进行连续对话啦喵！
      const response = await chat.sendMessageStream({
        message: userPrompt,
      });

      // 5. 显示回复
      console.log(`\nmodel:`);
      for await (const res of response) {
        process.stdout.write(res.text || '');
      }
      process.stdout.write('\n');

    } catch (error) {
      // 呜...这个 Bug 好烦喵! ls 的脑袋要长蘑菇了喵...
      console.error("\n❌ 呜...聊天过程中出错了喵 QAQ:", error);
      // 不过没关系~ ls 是不会认输的喵!
      console.log("请重试或者检查你的网络连接和 API Key 喵！");
    }
  }
}

// 运行主函数
main();
