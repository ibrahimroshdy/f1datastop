import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getVisibleNavItems } from "./navigation";

// vitest runs from web/; vercel.json lives one level up.
const webRoot = process.cwd();
const read = (...parts: string[]) => readFileSync(resolve(webRoot, ...parts), "utf8");

describe("docs link and /developers move (#62)", () => {
  it("has no /developers nav item", () => {
    expect(getVisibleNavItems().some((i) => i.href === "/developers")).toBe(false);
  });

  it("has exactly one external Docs item", () => {
    const docs = getVisibleNavItems().filter((i) => i.label === "Docs");
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      label: "Docs",
      href: "https://docs.f1datastop.com",
      external: true,
    });
  });

  it("redirects /developers to the docs page in vercel.json", () => {
    const config = JSON.parse(read("..", "vercel.json"));
    expect(config.redirects).toContainEqual({
      source: "/developers",
      destination: "https://docs.f1datastop.com/developers.html",
      permanent: true,
    });
  });

  it("drops /developers from the sitemap and its generator", () => {
    expect(read("public", "sitemap.xml")).not.toContain("/developers");
    expect(read("scripts", "generate-sitemap.mjs")).not.toContain("/developers");
  });

  it("removes the Share button and adds the GitHub link in the top bar", () => {
    expect(read("src", "components", "layout", "TopBar.tsx")).not.toContain("ShareButton");
    expect(read("src", "components", "layout", "social", "SocialLinks.tsx")).toContain(
      "https://github.com/ibrahimroshdy/f1datastop",
    );
  });
});
