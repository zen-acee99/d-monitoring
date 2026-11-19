import fs from "fs";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
console.log("Dependencies:", Object.keys(pkg.dependencies || {}));
console.log("DevDependencies:", Object.keys(pkg.devDependencies || {}));
