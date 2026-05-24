import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const packageJsonPath = path.join(process.cwd(), "package.json");
if (!fs.existsSync(packageJsonPath)) {
  console.error("package.json not found.");
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const deps = {
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
};

const hasPrismaPackages = Boolean(deps.prisma) || Boolean(deps["@prisma/client"]);
const hasPrismaSchema = fs.existsSync(path.join(process.cwd(), "prisma", "schema.prisma"));

if (!hasPrismaPackages || !hasPrismaSchema) {
  console.log("Prisma is not configured in this repository yet.");
  console.log("Expected: prisma package, @prisma/client package, and prisma/schema.prisma.");
  process.exit(0);
}

const result = spawnSync("npm.cmd", ["exec", "--", "prisma", "validate"], {
  stdio: "inherit",
});
if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
