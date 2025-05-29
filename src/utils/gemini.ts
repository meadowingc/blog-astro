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

  // First, collect all footnotes from the document and create numbering
  const footnotes = new Map<string, string>();
  const footnoteNumbers = new Map<string, number>();
  let footnoteCounter = 0;

  const footnoteElements = document.querySelectorAll('section.footnotes ol li[id^="footnote-"]');
  footnoteElements.forEach((li) => {
    const id = li.getAttribute("id")?.replace("footnote-", "") || "";
    if (id) {
      // Remove the back-reference link before processing
      const backRefLink = li.querySelector("a[data-footnote-backref]");
      if (backRefLink) {
        backRefLink.remove();
      }

      // Process the footnote content to handle links properly
      // We need to clone the element to avoid modifying the original
      const clonedLi = li.cloneNode(true) as Element;
      const clonedBackRefLink = clonedLi.querySelector("a[data-footnote-backref]");
      if (clonedBackRefLink) {
        clonedBackRefLink.remove();
      }

      // Process the footnote content with links
      const content = Array.from(clonedLi.childNodes)
        .map((child) => processFootnoteNode(child))
        .join("")
        .trim();

      footnotes.set(id, content);
      footnoteNumbers.set(id, ++footnoteCounter);
    }
  });

  // Helper function to process footnote content and extract links
  function processFootnoteNode(node: Node): string {
    if (node.nodeType === dom.window.Node.TEXT_NODE) {
      return node.textContent || "";
    }

    if (node.nodeType === dom.window.Node.ELEMENT_NODE) {
      const element = node as Element;

      switch (element.tagName.toLowerCase()) {
        case "a":
          const href = element.getAttribute("href");
          const linkText = element.textContent?.trim() || "";

          if (href && !href.startsWith("#")) {
            const absoluteHref = href.startsWith("http") ? href : href.startsWith("/") ? `https://meadow.cafe${href}` : href;

            extractedLinks.push({
              url: encodeURI(absoluteHref),
              text: linkText,
              id: linkText,
            });

            return linkText;
          }
          return linkText;

        case "em":
        case "i":
          return `*${element.textContent}*`;

        case "strong":
        case "b":
          return `**${element.textContent}**`;

        case "code":
          return `\`${element.textContent}\``;

        case "p":
        case "div":
        case "span":
          // Just process children for these elements
          return Array.from(element.childNodes)
            .map((child) => processFootnoteNode(child))
            .join("");

        default:
          // For other elements, just process the children
          return Array.from(element.childNodes)
            .map((child) => processFootnoteNode(child))
            .join("");
      }
    }

    return "";
  }

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
              if (child.nodeType === dom.window.Node.ELEMENT_NODE) {
                const childElement = child as Element;

                // Handle sup elements (which contain footnote references)
                if (childElement.tagName.toLowerCase() === "sup") {
                  const footnoteLink = childElement.querySelector("a[href^='#footnote-']");
                  if (footnoteLink) {
                    const href = footnoteLink.getAttribute("href");
                    if (href) {
                      const footnoteId = href.replace("#footnote-", "");
                      const footnoteNumber = footnoteNumbers.get(footnoteId);
                      if (footnoteNumber) {
                        return ` [${footnoteNumber}]`;
                      }
                    }
                  }
                  return childElement.textContent || "";
                }

                // Handle regular links (but skip footnote links)
                if (childElement.tagName.toLowerCase() === "a") {
                  const href = childElement.getAttribute("href");
                  const linkText = childElement.textContent?.trim() || "";

                  // Handle footnote references (in case they're not in sup)
                  if (href && href.startsWith("#footnote-")) {
                    const footnoteId = href.replace("#footnote-", "");
                    const footnoteNumber = footnoteNumbers.get(footnoteId);
                    if (footnoteNumber) {
                      return `[${footnoteNumber}]`;
                    }
                    return linkText;
                  }

                  // Handle regular links
                  if (href && !href.startsWith("#")) {
                    // Convert relative links to absolute for gemini
                    const absoluteHref = href.startsWith("http")
                      ? href
                      : href.startsWith("/")
                        ? `https://meadow.cafe${href}`
                        : href;

                    currentLinks.push({
                      url: encodeURI(absoluteHref),
                      text: linkText,
                      id: linkText, // Use link text instead of numbered reference
                    });

                    return linkText; // Just return the link text without numbering
                  }
                  return linkText;
                }
              }
              return processNode(child, false);
            })
            .join("");

          let result = pContent.trim();
          if (result) {
            result += "\n\n";

            // Add links after the paragraph
            if (currentLinks.length > 0) {
              result += currentLinks.map((link) => `=> ${link.url} ${link.text}`).join("\n") + "\n\n";
            }
          }

          return result;

        case "a":
          // This case should be handled by the parent element (p, li, etc.)
          const href = element.getAttribute("href");
          const linkText = element.textContent?.trim() || "";

          if (href && extractLinks) {
            const absoluteHref = href.startsWith("http") ? href : href.startsWith("/") ? `https://meadow.cafe${href}` : href;

            extractedLinks.push({
              url: encodeURI(absoluteHref),
              text: linkText,
              id: linkText,
            });

            return linkText;
          }
          return linkText;

        case "ul":
        case "ol":
          // Skip footnotes list as we handle them inline
          if (element.classList?.contains("footnotes")) {
            return "";
          }

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
                      const absoluteHref = href.startsWith("http")
                        ? href
                        : href.startsWith("/")
                          ? `https://meadow.cafe${href}`
                          : href;

                      currentLinks.push({
                        url: encodeURI(absoluteHref),
                        text: linkText,
                        id: linkText,
                      });

                      return linkText;
                    }
                    return linkText;
                  }
                  return processNode(child, false);
                })
                .join("")
                .trim();

              let result = `* ${liContent}`;
              if (currentLinks.length > 0) {
                result += "\n" + currentLinks.map((link) => `  => ${link.url} ${link.text}`).join("\n");
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

        case "sup":
          // Handle footnote references in sup elements
          const footnoteLink = element.querySelector("a[href^='#footnote-']");
          if (footnoteLink) {
            const href = footnoteLink.getAttribute("href");
            if (href) {
              const footnoteId = href.replace("#footnote-", "");
              const footnoteNumber = footnoteNumbers.get(footnoteId);
              if (footnoteNumber) {
                return `[${footnoteNumber}]`;
              }
            }
          }
          return element.textContent || "";

        case "img":
          const src = element.getAttribute("src");
          const alt = element.getAttribute("alt") || "Image";
          if (src) {
            const absoluteSrc = src.startsWith("http") ? src : src.startsWith("/") ? `https://meadow.cafe${src}` : src;
            return `=> ${encodeURI(absoluteSrc)} ${alt}\n\n`;
          }
          return "";

        case "div":
        case "span":
        case "article":
          // Skip footnotes section as we handle them inline
          if (element.classList?.contains("footnotes")) {
            return "";
          }
          // Just process children
          return Array.from(element.childNodes)
            .map((child) => processNode(child, extractLinks))
            .join("");
        case "section":
          // Skip footnotes section as we handle them inline
          if (element.classList?.contains("footnotes")) {
            return "";
          }
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

  // Add footnotes section if there are any footnotes
  if (footnotes.size > 0) {
    // if gemtext doesn't already end with --- then add it
    if (!gemtext.trim().endsWith("---")) {
      gemtext += "\n\n---\n\n";
    }

    gemtext += "\n\n## Footnotes\n\n";

    // Sort footnotes by their numbers
    const sortedFootnotes = Array.from(footnoteNumbers.entries()).sort((a, b) => a[1] - b[1]);

    for (const [footnoteId, footnoteNumber] of sortedFootnotes) {
      const footnoteText = footnotes.get(footnoteId);
      if (footnoteText) {
        gemtext += `- [${footnoteNumber}]: ${footnoteText}\n`;
      }
    }

    // Add any extracted links from footnotes
    if (extractedLinks.length > 0) {
      gemtext += "\n";
      extractedLinks.forEach((link) => {
        gemtext += `=> ${link.url} ${link.text}\n`;
      });
    }

    gemtext += "\n";
  } else if (extractedLinks.length > 0) {
    // If there are no footnotes but there are extracted links, add them at the end
    if (!gemtext.trim().endsWith("---")) {
      gemtext += "\n\n---\n\n";
    }
    gemtext += "\n";
    extractedLinks.forEach((link) => {
      gemtext += `=> ${link.url} ${link.text}\n`;
    });
    gemtext += "\n";
  }

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
