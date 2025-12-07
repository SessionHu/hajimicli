import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

import readline from 'node:readline/promises';
import fs from 'node:fs/promises';

import type { Content } from "@google/genai";

// ----------------------------------------------------
// 1. 配置加载与初始化
// ----------------------------------------------------

// 载入 .env 文件中的变量，让ls读取你的配置喵！
dotenv.config({quiet:true});

// 初始化 Gemini 客户端
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * 喵呜~ 这是一个可爱的函数，用来获取支持反斜杠续行的多行输入喵！
 * @param {readline.Interface} rl - readline 接口实例喵
 * @param {string} initialPrompt - 第一次显示的提示信息喵
 * @returns {Promise<string>} 拼接好的用户输入喵
 */
async function getMultilineInput(rl: readline.Interface, initialPrompt: string): Promise<string> {
  let fullInput = '';
  let currentPrompt = initialPrompt;

  while (true) {
    const line = await rl.question(currentPrompt);

    if (line.endsWith('\\')) {
      fullInput += line.slice(0, -1) + '\n'; // 移除反斜杠并添加换行符
      currentPrompt = '> '; // 续行提示符
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

// ----------------------------------------------------
// 2. 对话核心逻辑
// ----------------------------------------------------

/**
 * 喵呜~ 这是 CLI 的主函数，负责启动对话循环喵！
 * @returns {Promise<void>}
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
  console.log(`模型：${modelname}`);
  if (SYSTEM_PROMPT) {
    console.log(`系统提示词已设置 (✓)`);
  }
  console.log('输入 `/exit` 或 `/quit` 退出喵!');
  console.log('输入 `/model <model_name>` 切换模型喵!');
  console.log('输入 `/clear` 清除历史记录喵!');
  console.log(`-----------------------------------`);

  // 3. 循环等待用户输入
  while (true) {
    let userPrompt: string;
    try {
      userPrompt = await getMultilineInput(rl, '\nuser:\n> ');
    } catch (e) {
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

    // clear history
    else if (userPrompt.toLowerCase() === '/clear') {
      chat = createChat();
      console.log(`🧹 历史记录已清除喵~`);
      continue; // 继续下一次循环
    }

    else try {
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
