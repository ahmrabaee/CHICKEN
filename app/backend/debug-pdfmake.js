const fs = require('fs');
const path = require('path');

console.log('Checking pdfmake exports...');

try {
    const pm = require('pdfmake');
    console.log('require("pdfmake") type:', typeof pm);
    console.log('require("pdfmake") keys:', Object.keys(pm));
    if (typeof pm === 'object') console.log('Is instance?', pm.constructor ? pm.constructor.name : 'unknown');
} catch (e) {
    console.log('require("pdfmake") failed:', e.message);
}

const tryRequire = (p) => {
    try {
        console.log(`Trying require("${p}")...`);
        const mod = require(p);
        console.log(`Success! type: ${typeof mod}`);
        if (typeof mod === 'object') console.log('Keys:', Object.keys(mod));
        if (typeof mod === 'function') console.log('It is a function/class');
    } catch (e) {
        console.log(`Failed: ${e.message}`);
    }
};

tryRequire('pdfmake/src/printer');
tryRequire('pdfmake/js/printer');
tryRequire('pdfmake/js/Printer');
tryRequire('pdfmake/src/Printer');

console.log('Listing js/ dir:');
try {
    const jsDir = path.join(__dirname, 'node_modules', 'pdfmake', 'js');
    if (fs.existsSync(jsDir)) {
        console.log(fs.readdirSync(jsDir));
    } else {
        console.log('js/ dir not found');
    }
} catch (e) {
    console.log('Error listing js/:', e.message);
}
