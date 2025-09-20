import type { formattedText$Input, textEntity$Input } from "tdlib-types";
import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Root, Content } from "mdast";
import logger from "../../log/index.ts";

interface ParseContext {
  plainText: string;
  entities: textEntity$Input[];
}

/**
 * 将 Markdown 格式的文本解析为格式化文本
 * @param markdown - Markdown 格式的文本
 * @returns 包含格式化文本和实体信息的对象
 */
export function parseMarkdownToFormattedText(
  markdown: string
): formattedText$Input {
  try {
    // 解析 Markdown 为 AST
    const processor = unified().use(remarkParse);
    const ast = processor.parse(markdown) as Root;

    const context: ParseContext = {
      plainText: "",
      entities: [],
    };

    // 遍历 AST 节点并构建格式化文本
    processNodes(ast.children, context);

    return {
      _: "formattedText" as const,
      text: context.plainText,
      entities: context.entities,
    };
  } catch (error) {
    logger.error("解析 Markdown 失败:", error);
    return {
      _: "formattedText" as const,
      text: markdown,
      entities: [],
    };
  }
}

/**
 * 处理 AST 节点数组
 */
function processNodes(nodes: Content[], context: ParseContext): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    processNode(node, context);

    // 在处理完每个块级元素后，如果不是最后一个元素，则添加换行符
    if (i < nodes.length - 1) {
      if (
        [
          "heading",
          "blockquote",
          "paragraph",
          "code",
          "list",
          "thematicBreak",
        ].includes(node.type)
      ) {
        if (context.plainText.length > 0 && !context.plainText.endsWith("\n")) {
          context.plainText += "\n";
        }
      }
    }
  }
  // 处理完所有节点后，如果最后一个是块级元素，确保末尾有换行
  if (context.plainText.length > 0 && !context.plainText.endsWith("\n")) {
    context.plainText += "\n";
  }
}

/**
 * 处理单个 AST 节点
 */
function processNode(node: Content, context: ParseContext): void {
  switch (node.type) {
    case "heading":
      processHeading(node, context);
      break;
    case "blockquote":
      processBlockquote(node, context);
      break;
    case "paragraph":
      processParagraph(node, context);
      break;
    case "text":
      processText(node, context);
      break;
    case "link":
      processLink(node, context);
      break;
    case "strong":
      processStrong(node, context);
      break;
    case "emphasis":
      processEmphasis(node, context);
      break;
    case "code":
      processCode(node, context);
      break;
    case "inlineCode":
      processInlineCode(node, context);
      break;
    case "list":
      processList(node, context);
      break;
    case "thematicBreak":
      processThematicBreak(node, context);
      break;
    default:
      // 对于未处理的节点类型，递归处理子节点
      if ("children" in node && Array.isArray(node.children)) {
        processNodes(node.children as Content[], context);
      }
      break;
  }
}

/**
 * 处理标题节点
 */
function processHeading(node: any, context: ParseContext): void {
  const startOffset = context.plainText.length;

  // 处理标题内容
  if (node.children) {
    processNodes(node.children, context);
  }

  const endOffset = context.plainText.length;

  // 添加标题实体
  context.entities.push({
    _: "textEntity",
    offset: startOffset,
    length: endOffset - startOffset,
    type: {
      _: "textEntityTypeBold",
    },
  });
}

/**
 * 处理引用块节点
 */
function processBlockquote(node: any, context: ParseContext, depth = 1): void {
  const startOffset = context.plainText.length;

  if (node.children) {
    for (const child of node.children) {
      if (child.type === "blockquote") {
        // 递归调用，但不再创建实体
        processBlockquote(child, context, depth + 1);
      } else {
        processNode(child, context);
      }
    }
  }

  // 只有最外层的 blockquote 才添加实体
  if (depth === 1) {
    const endOffset = context.plainText.length;
    // 检查子节点中是否有嵌套的 blockquote 来判断是否可折叠
    const isExpandable = node.children.some(
      (child: any) => child.type === "blockquote"
    );
    context.entities.push({
      _: "textEntity",
      offset: startOffset,
      length: endOffset - startOffset,
      type: isExpandable
        ? { _: "textEntityTypeExpandableBlockQuote" }
        : { _: "textEntityTypeBlockQuote" },
    });
  }
}

/**
 * 处理段落节点
 */
function processParagraph(node: any, context: ParseContext): void {
  if (node.children) {
    processNodes(node.children, context);
  }
}

/**
 * 处理文本节点
 */
function processText(node: any, context: ParseContext): void {
  context.plainText += node.value;
}

/**
 * 处理链接节点
 */
function processLink(node: any, context: ParseContext): void {
  const startOffset = context.plainText.length;

  // 提取链接文本
  const linkText = extractTextFromNodes(node.children);

  // 验证 URL 是否为允许的格式: tg://, http(s)://, 或以 www. 或裸域名开头
  const rawUrl: string = String(node.url || "").trim();
  const isValidLink =
    rawUrl.startsWith("tg://") ||
    rawUrl.startsWith("http://") ||
    rawUrl.startsWith("https://") ||
    /^www\.[^\s]+\.[^\s]+$/.test(rawUrl) ||
    /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(rawUrl);

  if (!isValidLink) {
    // 如果不是有效链接，则保留原始 Markdown 文本，例如 [text](url)，且不创建实体
    context.plainText += `[${linkText}](${rawUrl})`;
    return;
  }

  // 自动补全缺失的协议（对 www. 或裸域名补 http://）
  // 先特殊处理 tg:// 链接，优先于补协议逻辑，避免误操作
  if (rawUrl.startsWith("tg://")) {
    // 针对 tg://user?id=... 使用 URLSearchParams 提取 id，支持额外参数
    if (rawUrl.startsWith("tg://user")) {
      const query = rawUrl.split("?")[1] || "";
      const params = new URLSearchParams(query);
      const idStr = params.get("id");
      const userId = idStr ? parseInt(idStr, 10) : NaN;
      if (!Number.isNaN(userId)) {
        context.plainText += linkText;
        const endOffset = context.plainText.length;
        context.entities.push({
          _: "textEntity",
          offset: startOffset,
          length: endOffset - startOffset,
          type: {
            _: "textEntityTypeMentionName",
            user_id: userId,
          },
        });
        return;
      }
      // 解析失败则保留原文
      context.plainText += `[${linkText}](${rawUrl})`;
      return;
    }

    // 其它 tg:// 链接当作文本 URL 处理（不补协议）
    context.plainText += linkText;
    const endOffset = context.plainText.length;
    context.entities.push({
      _: "textEntity",
      offset: startOffset,
      length: endOffset - startOffset,
      type: {
        _: "textEntityTypeTextUrl",
        url: rawUrl,
      },
    });
    return;
  }

  let processedUrl = rawUrl;
  if (!/^https?:\/\//i.test(processedUrl)) {
    if (
      /^www\./i.test(processedUrl) ||
      /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(processedUrl)
    ) {
      processedUrl = "http://" + processedUrl;
    }
  }

  // 其他有效链接按文本 URL 处理
  context.plainText += linkText;
  const endOffset = context.plainText.length;
  context.entities.push({
    _: "textEntity",
    offset: startOffset,
    length: endOffset - startOffset,
    type: {
      _: "textEntityTypeTextUrl",
      url: processedUrl,
    },
  });
}

/**
 * 处理粗体节点
 */
function processStrong(node: any, context: ParseContext): void {
  const startOffset = context.plainText.length;

  if (node.children) {
    processNodes(node.children, context);
  }

  const endOffset = context.plainText.length;

  context.entities.push({
    _: "textEntity",
    offset: startOffset,
    length: endOffset - startOffset,
    type: {
      _: "textEntityTypeBold",
    },
  });
}

/**
 * 处理斜体节点
 */
function processEmphasis(node: any, context: ParseContext): void {
  const startOffset = context.plainText.length;

  if (node.children) {
    processNodes(node.children, context);
  }

  const endOffset = context.plainText.length;

  context.entities.push({
    _: "textEntity",
    offset: startOffset,
    length: endOffset - startOffset,
    type: {
      _: "textEntityTypeItalic",
    },
  });
}

/**
 * 处理代码块节点
 */
function processCode(node: any, context: ParseContext): void {
  const startOffset = context.plainText.length;
  const codeText = node.value;
  context.plainText += codeText;
  const endOffset = context.plainText.length;

  context.entities.push({
    _: "textEntity",
    offset: startOffset,
    length: endOffset - startOffset,
    type: {
      _: "textEntityTypePreCode",
      language: node.lang || "",
    },
  });
}

/**
 * 处理行内代码节点
 */
function processInlineCode(node: any, context: ParseContext): void {
  const startOffset = context.plainText.length;
  context.plainText += node.value;
  const endOffset = context.plainText.length;

  context.entities.push({
    _: "textEntity",
    offset: startOffset,
    length: endOffset - startOffset,
    type: {
      _: "textEntityTypeCode",
    },
  });
}

/**
 * 处理列表节点
 */
function processList(node: any, context: ParseContext): void {
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      const item = node.children[i];
      if (item.type === "listItem") {
        processListItem(item, context, node.ordered ? `${i + 1}. ` : "* ");
      }
    }
  }
}

/**
 * 处理列表项节点
 */
function processListItem(
  node: any,
  context: ParseContext,
  prefix: string
): void {
  context.plainText += prefix;
  if (node.children) {
    processNodes(node.children, context);
  }
}

/**
 * 处理分割线节点
 */
function processThematicBreak(node: any, context: ParseContext): void {
  context.plainText += "---";
}

/**
 * 从节点数组中提取纯文本
 */
function extractTextFromNodes(nodes: Content[]): string {
  let text = "";
  for (const node of nodes) {
    if (node.type === "text") {
      text += node.value;
    } else if ("children" in node && Array.isArray(node.children)) {
      text += extractTextFromNodes(node.children as Content[]);
    }
  }
  return text;
}
