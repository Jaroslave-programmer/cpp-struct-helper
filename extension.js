const vscode = require('vscode');
const path = require('path');

/**
 * Словарь (Map) стандартных типов C++ и их значений по умолчанию.
 * @type {Map<string, string>}
 */
const DEFAULT_CPP_VALUES = new Map([
    ['int', '0'], ['long', '0L'], ['size_t', '0u'],
    ['float', '0.0f'], ['double', '0.0'], ['bool', 'false'],
    ['char', "'\\0'"], ['std::string', '""'], ['string', '""']
]);

/**
 * Возвращает значение по умолчанию для заданного типа C++.
 * @param {string} cppType - Тип данных C++
 * @returns {string} Начальное значение для конструктора
 */
function getDefaultValueForType(cppType) {
    const cleanType = cppType.trim();
    if (cleanType.includes('*')) return 'nullptr';
    return DEFAULT_CPP_VALUES.has(cleanType) ? DEFAULT_CPP_VALUES.get(cleanType) : '{}';
}

/**
 * Делает первую букву имени поля заглавной для генерации геттеров и сеттеров.
 * @param {string} fieldName - Имя поля класса
 * @returns {string} Форматированное имя поля
 */
function capitalizeIdentifier(fieldName) {
    const cleaned = fieldName.replace(/^_+|_{1,2}$/g, '');
    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'Field';
}

/**
 * Парсит выделенные строки с полями C++, отсеивая дубликаты через Set.
 * @param {string} rawText - Выделенный текст в редакторе
 * @returns {Array<{type: string, name: string, defaultVal: string, capName: string}>}
 */
function parseCppFields(rawText) {
    const lines = rawText.split(/\r?\n/);
    const parsedFields = [];
    const seenFieldNames = new Set();

    for (const rawLine of lines) {
        const line = rawLine.trim().replace(/;+$/, '').trim();
        if (!line || line.startsWith('//')) continue;

        const parts = line.split(/\s+/);
        if (parts.length < 2) continue;

        const fieldName = parts[parts.length - 1];
        const fieldType = parts.slice(0, parts.length - 1).join(' ');

        if (seenFieldNames.has(fieldName)) continue;
        seenFieldNames.add(fieldName);

        parsedFields.push({
            type: fieldType,
            name: fieldName,
            defaultVal: getDefaultValueForType(fieldType),
            capName: capitalizeIdentifier(fieldName)
        });
    }
    return parsedFields;
}

/**
 * Генерирует полный код C++ класса по имени и массиву разобранных полей.
 * @param {string} className - Имя создаваемого класса
 * @param {Array<Object>} fields - Массив полей класса
 * @returns {string} Сгенерированный C++ код класса
 */
function buildCppClassCode(className, fields) {
    const privateLines = fields.map(f => `    ${f.type} ${f.name}_;`);
    const defaultInit = fields.map(f => `${f.name}_(${f.defaultVal})`).join(', ');
    const params = fields.map(f => `${f.type} ${f.name}`).join(', ');
    const paramInit = fields.map(f => `${f.name}_(${f.name})`).join(', ');

    const accessors = [];
    for (const f of fields) {
        accessors.push(`    ${f.type} get${f.capName}() const { return ${f.name}_; }`);
        accessors.push(`    void set${f.capName}(${f.type} value) { ${f.name}_ = value; }`);
    }

    return [
        `class ${className} {`,
        `private:`,
        ...privateLines,
        ``,
        `public:`,
        `    ${className}() : ${defaultInit} {}`,
        `    ${className}(${params}) : ${paramInit} {}`,
        ``,
        ...accessors,
        `};`
    ].join('\n');
}

/**
 * Генерирует управляющий блок for или switch-case по введенным параметрам.
 * @param {string} kind - Тип конструкции ('for' или 'switch')
 * @param {string} paramInput - Параметры через запятую
 * @returns {string} Сгенерированный блок кода C++
 */
function buildControlBlock(kind, paramInput) {
    if (kind === 'for') {
        const parts = paramInput.split(',').map(s => s.trim());
        const v = parts[0] || 'i', lim = parts[1] || 'n', step = parts[2] || '1';
        const stepExpr = step === '1' ? `++${v}` : `${v} += ${step}`;
        return `for (size_t ${v} = 0; ${v} < ${lim}; ${stepExpr}) {\n    // TODO: тело цикла\n}`;
    }
    const parts = paramInput.split(',').map(s => s.trim()).filter(Boolean);
    const swVar = parts[0] || 'state';
    const cases = parts.slice(1);
    const lines = [`switch (${swVar}) {`];
    for (const c of cases) {
        lines.push(`    case ${c}:\n        break;`);
    }
    lines.push(`    default:\n        break;\n}`);
    return lines.join('\n');
}

/**
 * Формирует имя макроса защиты заголовка (Header Guard) по имени файла.
 * @param {string} filePath - Путь к открытому файлу
 * @returns {string} Имя макроса в верхнем регистре
 */
function makeHeaderGuardMacro(filePath) {
    return path.basename(filePath).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() + '_';
}

/**
 * Точка входа при активации плагина в VS Code. Регистрирует команды.
 * @param {vscode.ExtensionContext} context - Контекст расширения
 */
function activate(context) {
    const cmdClass = vscode.commands.registerCommand('cpp-struct-helper.generateClass', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        const text = editor.document.getText(editor.selection);
        const fields = parseCppFields(text);
        if (fields.length === 0) {
            vscode.window.showWarningMessage('Выделите строки с полями C++ (например: int id;)');
            return;
        }
        const className = await vscode.window.showInputBox({ prompt: 'Имя класса C++', value: 'MyClass' });
        if (!className) return;
        const code = buildCppClassCode(className.trim(), fields);
        await editor.edit(eb => eb.replace(editor.selection, code));
    });

    const cmdBlock = vscode.commands.registerCommand('cpp-struct-helper.generateControlBlock', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        const pick = await vscode.window.showQuickPick(['for', 'switch'], { placeHolder: 'Выберите блок' });
        if (!pick) return;
        const params = await vscode.window.showInputBox({
            prompt: pick === 'for' ? 'Переменная, граница, шаг' : 'Переменная, case1, case2...',
            value: pick === 'for' ? 'i, n, 1' : 'mode, 1, 2, 3'
        });
        if (!params) return;
        await editor.edit(eb => eb.insert(editor.selection.active, buildControlBlock(pick, params)));
    });

    const cmdGuard = vscode.commands.registerCommand('cpp-struct-helper.addHeaderGuard', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        const doc = editor.document;
        const macro = makeHeaderGuardMacro(doc.fileName);
        const fullText = doc.getText();
        const wrapped = `#ifndef ${macro}\n#define ${macro}\n\n${fullText}\n\n#endif // ${macro}`;
        const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(fullText.length));
        await editor.edit(eb => eb.replace(fullRange, wrapped));
    });

    context.subscriptions.push(cmdClass, cmdBlock, cmdGuard);
}

function deactivate() {}

module.exports = { activate, deactivate };