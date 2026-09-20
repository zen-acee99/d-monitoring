import fs from 'fs';
import { parse } from 'node-html-parser';

const html = fs.readFileSync('dist/index.html', 'utf-8');
console.log("Since it's a React app, we can't easily parse the dynamic DOM.");
