const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, 'public/images');

function renameFilesRecursively(dir) {
  const items = fs.readdirSync(dir);

  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      renameFilesRecursively(fullPath);
    } else {
      const newName = item.replace(/ /g, '_');
      if (newName !== item) {
        const newFullPath = path.join(dir, newName);
        fs.renameSync(fullPath, newFullPath);
        console.log(`Renombrado: "${item}" -> "${newName}"`);
      }
    }
  });
}

renameFilesRecursively(imagesDir);

console.log('Renombrado de archivos terminado!');
