const Printer = require('pdfmake/js/Printer');
const fs = require('fs');

const fonts = {
    Cairo: {
        normal: 'C:\\Windows\\Fonts\\arial.ttf',
        bold: 'C:\\Windows\\Fonts\\arialbd.ttf',
        italics: 'C:\\Windows\\Fonts\\arial.ttf',
        bolditalics: 'C:\\Windows\\Fonts\\arialbd.ttf',
    }
};

try {
    console.log('Printer export type:', typeof Printer);
    console.log('Printer keys:', Object.keys(Printer));

    let PrinterClass = Printer;
    if (Printer.default) {
        console.log('Found .default export');
        PrinterClass = Printer.default;
    }

    // Check if PrinterClass is a constructor
    try {
        new PrinterClass(fonts);
        console.log('Constructor is valid!');
    } catch (e) {
        console.log('Constructor check failed:', e.message);
    }

    const printer = new PrinterClass(fonts);
    const doc = {
        content: ['Test PDF'],
        defaultStyle: { font: 'Cairo' }
    };
    const pdfDoc = printer.createPdfKitDocument(doc);
    console.log('pdfDoc type:', typeof pdfDoc);
    console.log('pdfDoc keys:', Object.keys(pdfDoc));
    console.log('Is Promise?', pdfDoc instanceof Promise);

    if (pdfDoc.pipe) {
        pdfDoc.pipe(fs.createWriteStream('test-simple-out.pdf'));
        pdfDoc.end();
        console.log('PDF Generation Successful!');
    } else {
        console.log('Result is not a stream (no .pipe)');
    }
} catch (e) {
    console.error('PDF Generation Failed:', e);
}
