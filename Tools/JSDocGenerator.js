const fs = require('fs');

const src = process.argv[2];
const startFunc = process.argv[3];
const endFunc = process.argv[4];

if (!src || !startFunc || !endFunc) {
    console.error('Usage: node extract-docs.js <file.js> <startFunc> <endFunc>');
    process.exit(1);
}

const code = fs.readFileSync(src, 'utf8');
const pattern = /(\/\*\*[\s\S]*?\*\/)\s*(async\s+)?(\w+)\s*\(/g;

let match;
const results = [];
let capturing = false;

while ((match = pattern.exec(code)) !== null) {
    const [, jsdoc, asyncKeyword, name] = match;

    if (name === startFunc) capturing = true;

    if (capturing) {
        const sigStart = match.index + match[0].indexOf(asyncKeyword || name);
        const sigEnd = code.indexOf('{', sigStart);
        const signature = code.slice(sigStart, sigEnd).trim();
        results.push(`${jsdoc}\n${signature}\n`);
    }

    if (capturing && name === endFunc) break;
}

if (results.length === 0) {
    console.error(`No functions found between "${startFunc}" and "${endFunc}". Check spelling.`);
    process.exit(1);
}

fs.writeFileSync('docs.txt', results.join('\n' + '-'.repeat(60) + '\n\n'));
console.log(`Extracted ${results.length} function