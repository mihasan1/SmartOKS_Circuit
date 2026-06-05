/* =====================================================================
 * i18n.js — English / Ukrainian localization
 * ===================================================================== */
(function (global) {
  'use strict';

  const DICT = {
    en: {
      ui: {
        run: '▶ Run', stop: '⏸ Stop', rotate: '⟳ Rotate', delete: '🗑 Delete',
        save: '💾 Save', load: '📂 Load', clear: '✖ Clear', language: 'Language',
        ready: 'Ready', stopped: 'Stopped', simRunning: 'Simulation running',
        placing: 'Placing: {name} — click on the canvas',
        solveError: "Error: circuit could not be solved (check shorts / sources)",
        noGround: 'No ground placed — node 0 used as floating reference.',
        demoLoaded: 'Demo circuit loaded. Press ▶ Run.',
        simError: 'Simulation error: {msg}',
        confirmClear: 'Clear the whole canvas?',
        fileError: 'File error: {msg}',
        props_title: 'Properties', nothing_selected: 'Nothing selected',
        hint: "Pick a part on the left → click the canvas to place it. Click a pin (•) to start a wire."
      },
      cat: {
        Sources: 'Sources', Passive: 'Passive', Indicators: 'Indicators',
        Switches: 'Switches', Meters: 'Meters', Digital: 'Digital',
        'Logic Gates': 'Logic Gates', Instruments: 'Instruments'
      },
      prop: {
        R: 'Resistance', V: 'Voltage', I: 'Current', Vf: 'Forward voltage',
        rated: 'Rated', pos: 'Position', closed: 'Closed', state: 'State',
        voltage_on_elem: 'Voltage across', current: 'Current', src_current: 'Source current',
        meter_reading: 'Meter reading', output: 'Output', level: 'Level',
        node_potential: 'Node potential', no_data: 'No data',
        state_label: 'Logic level', on: 'ON', off: 'off', status: 'Status'
      },
      gen: {
        mode: 'Mode', burst: 'Burst (once)', cycle: 'Cycle (loop)', step: 'Step (manual)',
        freq: 'Frequency (Hz)', stepBtn: '⏭ Step', patterns: 'Signal rows', addRow: '+ Add row',
        clearRows: 'Clear rows', current: 'Current row', hex: 'Hex', bits: 'Bits Q15…Q0',
        import: 'Bulk import (one hex or 16-bit binary per line)', importBtn: 'Import', restart: '⟲ Restart'
      },
      la: {
        title: 'Logic Analyzer', window: 'Window (s)', clear: 'Clear capture',
        nodata: 'Run the simulation to capture signals', channel: 'CH'
      },
      comp: {
        'dc-source': 'DC Voltage', battery: 'Battery', 'current-source': 'Current Source',
        vcc: '+5V Rail', ground: 'Ground', resistor: 'Resistor', potentiometer: 'Potentiometer',
        lamp: 'Lamp', led: 'LED', switch: 'Switch (SPST)', pushbutton: 'Push Button',
        voltmeter: 'Voltmeter', ammeter: 'Ammeter', 'logic-toggle': 'Logic Switch',
        'logic-high': 'Logic 1 (Vcc)', 'logic-low': 'Logic 0 (GND)', 'logic-probe': 'Logic Probe',
        'gate-and': 'AND', 'gate-or': 'OR', 'gate-not': 'NOT', 'gate-buffer': 'BUFFER',
        'gate-nand': 'NAND', 'gate-nor': 'NOR', 'gate-xor': 'XOR', 'gate-xnor': 'XNOR',
        'signal-generator': 'Signal Generator', 'logic-analyzer': 'Logic Analyzer'
      }
    },
    uk: {
      ui: {
        run: '▶ Запустити', stop: '⏸ Стоп', rotate: '⟳ Поворот', delete: '🗑 Видалити',
        save: '💾 Зберегти', load: '📂 Завантажити', clear: '✖ Очистити', language: 'Мова',
        ready: 'Готово', stopped: 'Зупинено', simRunning: 'Симуляція активна',
        placing: 'Розміщення: {name} — клікніть на полотні',
        solveError: "Помилка: коло не вдалося розв'язати (перевірте короткі замикання / джерела)",
        noGround: 'Немає заземлення — вузол 0 використано як плаваючу опору.',
        demoLoaded: 'Демо-схема завантажена. Натисніть ▶ Запустити.',
        simError: 'Помилка симуляції: {msg}',
        confirmClear: 'Очистити все полотно?',
        fileError: 'Помилка файлу: {msg}',
        props_title: 'Властивості', nothing_selected: 'Нічого не вибрано',
        hint: "Оберіть елемент зліва → клікніть на полотні щоб розмістити. Клік по виводу (•) — почати з'єднання."
      },
      cat: {
        Sources: 'Джерела', Passive: 'Пасивні', Indicators: 'Індикатори',
        Switches: 'Перемикачі', Meters: 'Прилади', Digital: 'Цифрові',
        'Logic Gates': 'Лог. елементи', Instruments: 'Інструменти'
      },
      prop: {
        R: 'Опір', V: 'Напруга', I: 'Струм', Vf: 'Пряма напруга',
        rated: 'Номінал', pos: 'Положення', closed: 'Замкнено', state: 'Стан',
        voltage_on_elem: 'Напруга на елементі', current: 'Струм', src_current: 'Струм джерела',
        meter_reading: 'Показ приладу', output: 'Вихід', level: 'Рівень',
        node_potential: 'Потенціал вузла', no_data: 'Немає даних',
        state_label: 'Логічний рівень', on: 'УВІМК', off: 'вимк', status: 'Стан'
      },
      gen: {
        mode: 'Режим', burst: 'Burst (один прохід)', cycle: 'Cycle (цикл)', step: 'Step (вручну)',
        freq: 'Частота (Гц)', stepBtn: '⏭ Крок', patterns: 'Ряди сигналів', addRow: '+ Додати ряд',
        clearRows: 'Очистити ряди', current: 'Поточний ряд', hex: 'Hex', bits: 'Біти Q15…Q0',
        import: 'Масовий ввід (по рядку: hex або 16-бітний двійковий)', importBtn: 'Імпорт', restart: '⟲ Спочатку'
      },
      la: {
        title: 'Логічний аналізатор', window: 'Вікно (с)', clear: 'Очистити запис',
        nodata: 'Запустіть симуляцію для запису сигналів', channel: 'К'
      },
      comp: {
        'dc-source': 'Джерело напруги', battery: 'Батарея', 'current-source': 'Джерело струму',
        vcc: 'Шина +5В', ground: 'Заземлення', resistor: 'Резистор', potentiometer: 'Потенціометр',
        lamp: 'Лампа', led: 'Світлодіод', switch: 'Перемикач', pushbutton: 'Кнопка',
        voltmeter: 'Вольтметр', ammeter: 'Амперметр', 'logic-toggle': 'Лог. перемикач',
        'logic-high': 'Лог. 1 (Vcc)', 'logic-low': 'Лог. 0 (GND)', 'logic-probe': 'Лог. пробник',
        'gate-and': 'AND', 'gate-or': 'OR', 'gate-not': 'NOT', 'gate-buffer': 'BUFFER',
        'gate-nand': 'NAND', 'gate-nor': 'NOR', 'gate-xor': 'XOR', 'gate-xnor': 'XNOR',
        'signal-generator': 'Генератор сигналів', 'logic-analyzer': 'Логічний аналізатор'
      }
    }
  };

  let lang = localStorage.getItem('smartoks-lang') || 'uk';
  if (!DICT[lang]) lang = 'uk';

  const listeners = [];

  function get(path) {
    const parts = path.split('.');
    let cur = DICT[lang];
    for (const p of parts) { cur = cur && cur[p]; }
    if (cur === undefined) { // fallback to en
      cur = DICT.en;
      for (const p of parts) cur = cur && cur[p];
    }
    return cur;
  }

  function t(path, vars) {
    let s = get(path);
    if (typeof s !== 'string') return path;
    if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
  }

  function comp(type) { return (DICT[lang].comp[type]) || (DICT.en.comp[type]) || type; }
  function cat(c) { return t('cat.' + c); }

  function set(l) {
    if (!DICT[l]) return;
    lang = l; localStorage.setItem('smartoks-lang', l);
    applyStatic();
    listeners.forEach(fn => fn());
  }
  function onChange(fn) { listeners.push(fn); }

  function applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.documentElement.lang = lang;
  }

  global.I18n = { t, comp, cat, set, onChange, applyStatic, get lang() { return lang; }, langs: Object.keys(DICT) };
})(window);
