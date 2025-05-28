import { JSDOM } from "jsdom";

/**
 * Convert HTML content to Gemini text format
 * Gemini uses a simplified markup format with specific rules
 * Links must be on their own line in Gemini format
 */
export function htmlToGemtext(html: string): string {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Track extracted links to append at the end of sections
  let extractedLinks: { url: string; text: string; id: string }[] = [];
  let linkCounter = 0;

  function processNode(node: Node, extractLinks = false): string {
    if (node.nodeType === dom.window.Node.TEXT_NODE) {
      return node.textContent || "";
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
          // Extract links from paragraphs and append them after the paragraph text
          const currentLinks: { url: string; text: string; id: string }[] = [];

          const pContent = Array.from(element.childNodes)
            .map((child) => {
              if (child.nodeType === dom.window.Node.ELEMENT_NODE && (child as Element).tagName.toLowerCase() === "a") {
                const linkElement = child as Element;
                const href = linkElement.getAttribute("href");
                const linkText = linkElement.textContent?.trim() || "";

                if (href) {
                  linkCounter++;
                  const linkId = `[${linkCounter}]`;

                  // Convert relative links to absolute for gemini
                  const absoluteHref = href.startsWith("http")
                    ? href
                    : href.startsWith("/")
                      ? `https://meadow.cafe${href}`
                      : href;

                  currentLinks.push({
                    url: encodeURI(absoluteHref),
                    text: linkText,
                    id: linkId,
                  });

                  return linkText + ` ${linkId}`;
                }
                return linkText;
              }
              return processNode(child, false);
            })
            .join("");

          let result = pContent.trim();
          if (result) {
            result += "\n\n";

            // Add links after the paragraph
            if (currentLinks.length > 0) {
              result += currentLinks.map((link) => `=> ${link.url} ${link.id} ${link.text}`).join("\n") + "\n\n";
            }
          }

          return result;

        case "a":
          // This case should be handled by the parent element (p, li, etc.)
          const href = element.getAttribute("href");
          const linkText = element.textContent?.trim() || "";

          if (href && extractLinks) {
            linkCounter++;
            const linkId = `[${linkCounter}]`;

            const absoluteHref = href.startsWith("http") ? href : href.startsWith("/") ? `https://meadow.cafe${href}` : href;

            extractedLinks.push({
              url: encodeURI(absoluteHref),
              text: linkText,
              id: linkId,
            });

            return linkText + ` ${linkId}`;
          }
          return linkText;

        case "ul":
        case "ol":
          const listItems = Array.from(element.children)
            .filter((child) => child.tagName.toLowerCase() === "li")
            .map((li) => {
              const currentLinks: { url: string; text: string; id: string }[] = [];

              const liContent = Array.from(li.childNodes)
                .map((child) => {
                  if (child.nodeType === dom.window.Node.ELEMENT_NODE && (child as Element).tagName.toLowerCase() === "a") {
                    const linkElement = child as Element;
                    const href = linkElement.getAttribute("href");
                    const linkText = linkElement.textContent?.trim() || "";

                    if (href) {
                      linkCounter++;
                      const linkId = `[${linkCounter}]`;

                      const absoluteHref = href.startsWith("http")
                        ? href
                        : href.startsWith("/")
                          ? `https://meadow.cafe${href}`
                          : href;

                      currentLinks.push({
                        url: encodeURI(absoluteHref),
                        text: linkText,
                        id: linkId,
                      });

                      return linkText + ` ${linkId}`;
                    }
                    return linkText;
                  }
                  return processNode(child, false);
                })
                .join("")
                .trim();

              let result = `* ${liContent}`;
              if (currentLinks.length > 0) {
                result += "\n" + currentLinks.map((link) => `  => ${link.url} ${link.id} ${link.text}`).join("\n");
              }
              return result;
            })
            .join("\n");
          return `${listItems}\n\n`;

        case "li":
          // Handled by ul/ol above
          return Array.from(element.childNodes)
            .map((child) => processNode(child, false))
            .join("");

        case "blockquote":
          const quoteContent = Array.from(element.childNodes)
            .map((child) => processNode(child, false))
            .join("")
            .trim();
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
          return Array.from(element.childNodes)
            .map((child) => processNode(child, extractLinks))
            .join("");

        default:
          // For unknown elements, just process the text content
          return Array.from(element.childNodes)
            .map((child) => processNode(child, extractLinks))
            .join("");
      }
    }

    return "";
  }

  let gemtext = Array.from(document.body.childNodes as NodeListOf<Node>)
    .map((node: Node) => processNode(node, true))
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
export function createGeminiHeader(title: string, subtitle?: string, skipWebVersion: boolean = false): string {
  let header = `# ${title}\n\n`;
  if (subtitle) {
    header += `${subtitle}\n\n`;
  }
  header += `=> / 🏠 Home\n`;

  if (!skipWebVersion) {
    header += `=> https://meadow.cafe/ 🌐 Web Version\n\n`;
  } else {
    header += `\n`;
  }

  header += `---\n\n`;
  return header;
}

/**
 * Generate gemtext footer
 */
export function createGeminiFooter(): string {
  return `\n\n---\n\n`;
}
