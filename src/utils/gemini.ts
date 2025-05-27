import { JSDOM } from "jsdom";

/**
 * Convert HTML content to Gemini text format
 * Gemini uses a simplified markup format with specific rules
 */
export function htmlToGemtext(html: string): string {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  let gemtext = "";

  function processNode(node: Node): string {
    if (node.nodeType === dom.window.Node.TEXT_NODE) {
      return node.textContent?.trim() || "";
    }

    if (node.nodeType === dom.window.Node.ELEMENT_NODE) {
      const element = node as Element;

      switch (element.tagName.toLowerCase()) {
        case "h1":
          return `# ${element.textContent?.trim()}\n\n`;
        case "h2":
          return `## ${element.textContent?.trim()}\n\n`;
        case "h3":
          return `### ${element.textContent?.trim()}\n\n`;
        case "h4":
        case "h5":
        case "h6":
          return `### ${element.textContent?.trim()}\n\n`;

        case "p":
          const pContent = Array.from(element.childNodes).map(processNode).join("");
          return pContent.trim() ? `${pContent.trim()}\n\n` : "";

        case "a":
          const href = element.getAttribute("href");
          const linkText = element.textContent?.trim() || "";
          if (href) {
            // Convert relative links to absolute for gemini
            const absoluteHref = href.startsWith("http") ? href : href.startsWith("/") ? `https://meadow.cafe${href}` : href;
            return `=> ${absoluteHref} ${linkText}`;
          }
          return linkText;

        case "ul":
        case "ol":
          const listItems = Array.from(element.children)
            .filter((child) => child.tagName.toLowerCase() === "li")
            .map((li) => `* ${Array.from(li.childNodes).map(processNode).join("").trim()}`)
            .join("\n");
          return `${listItems}\n\n`;

        case "li":
          // Handled by ul/ol above
          return Array.from(element.childNodes).map(processNode).join("");

        case "blockquote":
          const quoteContent = Array.from(element.childNodes).map(processNode).join("").trim();
          return `> ${quoteContent.replace(/\n/g, "\n> ")}\n\n`;

        case "code":
          return `\`${element.textContent}\``;

        case "pre":
          const codeContent = element.textContent || "";
          return `\`\`\`\n${codeContent}\n\`\`\`\n\n`;

        case "em":
        case "i":
          return `*${element.textContent}*`;

        case "strong":
        case "b":
          return `**${element.textContent}**`;

        case "br":
          return "\n";

        case "hr":
          return "---\n\n";

        case "img":
          const src = element.getAttribute("src");
          const alt = element.getAttribute("alt") || "Image";
          if (src) {
            const absoluteSrc = src.startsWith("http") ? src : src.startsWith("/") ? `https://meadow.cafe${src}` : src;
            return `=> ${absoluteSrc} ${alt}\n\n`;
          }
          return "";

        case "div":
        case "span":
        case "article":
        case "section":
          // Just process children
          return Array.from(element.childNodes).map(processNode).join("");

        default:
          // For unknown elements, just process the text content
          return Array.from(element.childNodes).map(processNode).join("");
      }
    }

    return "";
  }

  gemtext = Array.from(document.body.childNodes as NodeListOf<Node>)
    .map((node: Node) => processNode(node))
    .join("");

  // Clean up excessive whitespace
  gemtext = gemtext.replace(/\n{3,}/g, "\n\n");
  gemtext = gemtext.trim();

  return gemtext;
}

/**
 * Create a gemini-formatted date string
 */
export function formatGeminiDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Generate gemtext header with site info
 */
export function createGeminiHeader(title: string, subtitle?: string): string {
  let header = `# ${title}\n\n`;
  if (subtitle) {
    header += `${subtitle}\n\n`;
  }
  header += `=> / 🏠 Home\n`;
  header += `=> https://meadow.cafe/ 🌐 Web Version\n\n`;
  header += `---\n\n`;
  return header;
}

/**
 * Generate gemtext footer
 */
export function createGeminiFooter(): string {
  return `\n\n---\n\n`;
}
