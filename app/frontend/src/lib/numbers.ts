export function normalizeToEnglishNumberString(value: string | number): string {
    if (value === null || value === undefined) return '';
    let str = String(value);

    // Convert Arabic-Indic digits to English digits
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

    for (let i = 0; i < 10; i++) {
        // Replace all occurrences using global regex
        str = str.replace(new RegExp(arabicNumbers[i], 'g'), i.toString())
            .replace(new RegExp(persianNumbers[i], 'g'), i.toString());
    }

    // Convert Arabic decimal separators and commas to dot
    str = str.replace(/[٫،,]/g, '.');

    // Preserve leading minus
    const isNegative = str.trim().startsWith('-');

    // Strip anything that is NOT a digit or a dot
    const cleanedParts = str.replace(/[^\d.]/g, '').split('.');

    let result = cleanedParts[0];
    if (cleanedParts.length > 1) {
        result += '.' + cleanedParts.slice(1).join('');
    }

    return isNegative && result ? `-${result}` : result;
}

export function formatEnglishNumber(value: number | string | null | undefined, options: Intl.NumberFormatOptions = {}): string {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return String(value);

    return new Intl.NumberFormat('en-US', {
        useGrouping: false,
        maximumFractionDigits: 4,
        ...options
    }).format(num);
}
