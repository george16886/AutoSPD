const fs = require('node:fs');
const path = require('node:path');

const EXTENSION = path.join(__dirname, '..');
const NEWLINE = String.fromCharCode(10);

function readExtensionFile(name) {
    return fs.readFileSync(path.join(EXTENSION, name), 'utf8');
}

/** Source that installs chrome.i18n in a test context, backed by the real messages */
function i18nPrelude(locale = 'zh_TW', uiLanguage = 'zh-TW') {
    const messages = readExtensionFile(`_locales/${locale}/messages.json`);
    return `chrome.i18n = (() => {
        const messages = ${messages};
        return {
            getUILanguage: () => ${JSON.stringify(uiLanguage)},
            getMessage(key, substitutions = []) {
                const entry = messages[key];
                if (!entry) return '';
                return entry.message.replace(/[$]arg(\\d)[$]/g, (_, n) => substitutions[n - 1] ?? '');
            }
        };
    })();`;
}

/** The scripts the extension loads, in order, as one source for vm */
function joinSources(locale, uiLanguage, ...files) {
    const parts = files.map(file => readExtensionFile(file).replace(/importScripts\([^)]*\);/, ''));
    return [i18nPrelude(locale, uiLanguage), ...parts].join(NEWLINE);
}

module.exports = { EXTENSION, readExtensionFile, i18nPrelude, joinSources };
