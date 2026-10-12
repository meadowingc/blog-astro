import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import markedKatex from "marked-katex-extension";

export function createMarkdownParser() {
  return new Marked().use(
    markedFootnote(),
    // Native MathML works without client-side scripts or styles, including in feeds.
    markedKatex({ output: "mathml", throwOnError: true }),
  );
}
