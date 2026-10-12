import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createMarkdownParser } from "../src/utils/markdown.js";

function render(markdown) {
  return new JSDOM(createMarkdownParser().parse(markdown)).window.document;
}

test("renders both equations from post 0074 as native MathML", () => {
  const document = render(String.raw`The total possible number of documents is:

$29^{1312000} \approx 10^{1918666}$

Compare that to the estimated number of atoms in the visible universe, $10^{82}$, which is almost laughable.`);

  const equations = [...document.querySelectorAll("math")];
  assert.equal(equations.length, 2);
  assert.ok(equations.every((math) => math.namespaceURI === "http://www.w3.org/1998/Math/MathML"));
  assert.deepEqual(
    equations.map((math) => math.querySelector("annotation").textContent),
    [String.raw`29^{1312000} \approx 10^{1918666}`, "10^{82}"],
  );
  assert.deepEqual(
    [...equations[0].querySelectorAll("msup")].map((power) => [...power.children].map((part) => part.textContent)),
    [
      ["29", "1312000"],
      ["10", "1918666"],
    ],
  );
  assert.equal(equations[0].querySelector("mo").textContent, "\u2248");
  assert.equal(equations[1].querySelector("msup").lastElementChild.textContent, "82");
  assert.equal(document.querySelector(".katex-html"), null);
  assert.equal(document.querySelector("script"), null);
  equations.forEach((math) => math.remove());
  assert.doesNotMatch(document.body.textContent, /\$/);
});

test("renders block math before Markdown can consume TeX syntax", () => {
  const document = render(String.raw`Before.

$$
\begin{aligned}
a_1 &= \frac{1}{2} \\
b_2 &= \sqrt{4}
\end{aligned}
$$

After.`);

  assert.equal(document.querySelectorAll('math[display="block"]').length, 1);
  assert.ok(document.querySelector("mfrac"));
  assert.ok(document.querySelector("msqrt"));
  assert.ok(document.querySelector("mtable"));
  assert.equal(document.querySelector("em"), null);
  assert.deepEqual(
    [...document.querySelectorAll("p")].map((p) => p.textContent),
    ["Before.", "After."],
  );
});

test("preserves code, escaped dollars, currency, and ordinary Markdown", () => {
  const document = render(
    String.raw`**Prices:** $10 and $20. Escaped: \$10^{82}\$.

Inline code: ` +
      "`$10^{82}$`" +
      `

\`\`\`tex
$29^{1312000} \\approx 10^{1918666}$
\`\`\`

[Link](https://example.com) and *emphasis*.`,
  );

  assert.equal(document.querySelector("math"), null);
  assert.equal(document.querySelector("strong").textContent, "Prices:");
  assert.match(document.body.textContent, /\$10 and \$20/);
  assert.match(document.body.textContent, /Escaped: \$10\^\{82\}\$/);
  assert.equal(document.querySelector("p code").textContent, "$10^{82}$");
  assert.equal(document.querySelector("pre code").textContent.trim(), String.raw`$29^{1312000} \approx 10^{1918666}$`);
  assert.equal(document.querySelector("a").href, "https://example.com/");
  assert.equal(document.querySelector("em").textContent, "emphasis");
});

test("keeps footnotes working alongside math, including inside footnotes", () => {
  const document = render("Atoms: $10^{82}$.[^atoms]\n\n[^atoms]: An estimate of $10^{82}$ atoms.");

  assert.equal(document.querySelectorAll("math").length, 2);
  const reference = document.querySelector("a[data-footnote-ref]");
  assert.ok(reference);
  const footnote = document.querySelector(reference.getAttribute("href"));
  assert.ok(footnote.querySelector("math"));
  assert.ok(footnote.querySelector("a[data-footnote-backref]"));
});

test("reports invalid TeX rather than silently leaving broken equations", () => {
  assert.throws(() => createMarkdownParser().parse(String.raw`$\frac{1}$`), /KaTeX parse error/);
});
