/**
 * algo-x-evm-sdk@0.1.2 publishes extensionless relative imports.
 * Node's ESM loader will not resolve ./teal to ./teal.js.
 * Reapply after install; a later SDK release can remove this.
 */
const fs = require("node:fs");
const path = require("node:path");

const pkgDir = path.join(__dirname, "..", "node_modules", "algo-x-evm-sdk");
const pkgPath = path.join(pkgDir, "package.json");
const indexPath = path.join(pkgDir, "dist", "index.js");

if (!fs.existsSync(indexPath)) {
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
if (pkg.type !== "module") {
  pkg.type = "module";
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

const original = fs.readFileSync(indexPath, "utf8");
const patched = original
  .replaceAll('from "./teal"', 'from "./teal.js"')
  .replaceAll('from "./utils"', 'from "./utils.js"');

if (patched !== original) {
  fs.writeFileSync(indexPath, patched);
}
