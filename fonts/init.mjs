import fs from "fs";
import path from "path";

const fontPaths = [
  "node_modules/@fontsource/inter/files/inter-latin-300-normal.woff",
  "node_modules/@fontsource/inter/files/inter-latin-500-normal.woff",
  "node_modules/@fontsource/inter/files/inter-latin-600-normal.woff",
  "node_modules/@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff",
];

const ensureDir = filePath => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

fontPaths.forEach(src => {
  const fileName = path.basename(src);
  const dest = path.join("public/fonts", fileName);
  ensureDir(dest);
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${src} → ${dest}`);
  }
});
