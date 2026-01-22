const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'node_modules', '@expo', 'metro', 'node_modules', 'metro-config', 'src', 'loadConfig.js');

try {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace toReversed() with reverse()
  content = content.replace(/configs\.toReversed\(\)/g, '[...configs].reverse()');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Successfully patched metro-config!');
} catch (error) {
  console.error('❌ Error patching file:', error.message);
  
  // Alternative location
  const altPath = path.join(__dirname, 'node_modules', 'metro-config', 'src', 'loadConfig.js');
  try {
    let altContent = fs.readFileSync(altPath, 'utf8');
    altContent = altContent.replace(/configs\.toReversed\(\)/g, '[...configs].reverse()');
    fs.writeFileSync(altPath, altContent, 'utf8');
    console.log('✅ Successfully patched alternative metro-config!');
  } catch (altError) {
    console.error('❌ Error patching alternative file:', altError.message);
  }
}
