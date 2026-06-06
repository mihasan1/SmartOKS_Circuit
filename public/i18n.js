/* =====================================================================
 * i18n.js — English / Ukrainian localization
 * ===================================================================== */
(function (global) {
  'use strict';

  const DICT = {
    en: {
      ui: {
        run: 'Run', stop: 'Stop', rotate: 'Rotate', delete: 'Delete',
        save: 'Save', load: 'Load', clear: 'Clear', language: 'Language',
        ready: 'Ready', stopped: 'Stopped', simRunning: 'Simulation running',
        placing: 'Placing: {name} — click on the canvas',
        solveError: "Error: circuit could not be solved (check shorts / sources)",
        noGround: 'No ground placed — node 0 used as floating reference.',
        demoLoaded: 'Demo circuit loaded. Press Run.',
        simError: 'Simulation error: {msg}',
        confirmClear: 'Clear the whole canvas?',
        fileError: 'File error: {msg}',
        props_title: 'Properties', nothing_selected: 'Nothing selected',
        hint: "Drag a part from the left onto the canvas. Click a pin to wire. Scroll = zoom, middle-drag = pan.",
        appTitle: 'Circuit Lab', needHelp: 'Need help?', contactFree: 'feel free to contact',
        getSupport: 'Get support', theme: 'Theme',
        tip_rotate: 'Rotate (R)', tip_delete: 'Delete (Del)', tip_save: 'Save', tip_load: 'Load',
        tip_clear: 'Clear', tip_help: 'Help & guide'
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
        freq: 'Frequency (Hz)', stepBtn: 'Step', patterns: 'Signal rows', addRow: '+ Add row',
        clearRows: 'Clear rows', current: 'Current row', hex: 'Hex', bits: 'Bits Q15…Q0',
        import: 'Bulk import (one hex or 16-bit binary per line)', importBtn: 'Import', restart: 'Restart'
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
      },
      help: {
        title: 'Help & User Guide',
        html: `
          <p><b>SmartOKS Circuit</b> is a browser-based electronics workbench for
          building and simulating analog &amp; digital circuits — sources, passives,
          indicators, logic gates, meters and lab instruments.</p>

          <h4>Building a circuit</h4>
          <ul>
            <li><b>Place</b> — click a part in the left sidebar, then click the canvas. The tool stays active so you can drop several; press <kbd>Esc</kbd> to stop.</li>
            <li><b>Wire</b> — click a pin (the orange dot), then click another pin to connect them.</li>
            <li><b>Move</b> — drag a part. <b>Select</b> a part to edit it in the right panel.</li>
            <li><b>Rotate</b> <kbd>R</kbd>, <b>Delete</b> <kbd>Del</kbd>. Double-click a switch or logic input to toggle it.</li>
            <li>Add a <b>Ground</b> for analog circuits — it is the 0&nbsp;V reference.</li>
          </ul>

          <h4>Running the simulation</h4>
          <p>Press <b>Run</b>. Wires are colored by node voltage (red = +, blue = −),
          lamps and LEDs light up, meters show live readings, and gate outputs update.
          The right panel shows voltage/current for the selected part.</p>

          <h4>Signal Generator</h4>
          <p>16 outputs (Q0…Q15). Each row is a 16-bit word shown in <b>hex</b>; click
          bits or type hex to edit, or bulk-import (one hex / 16-bit binary per line).
          Modes: <b>Burst</b> (one pass), <b>Cycle</b> (loop), <b>Step</b> (advance manually).
          Set the frequency for Burst/Cycle.</p>

          <h4>Logic Analyzer</h4>
          <p>16 inputs (D0…D15). Wire signals to it and press Run — it captures a live
          timing diagram in the bottom dock. Adjust the time window or clear the capture.</p>

          <h4>General</h4>
          <ul>
            <li><b>Theme</b> — toggle light / dark in the top bar.</li>
            <li><b>Language</b> — English / Ukrainian.</li>
            <li><b>Save / Load</b> circuits as JSON; your work also autosaves locally.</li>
          </ul>
          <p class="help-link">Source &amp; issues:
            <a href="https://github.com/mihasan1/SmartOKS_Circuit" target="_blank" rel="noopener">github.com/mihasan1/SmartOKS_Circuit</a></p>
        `
      }
    },
    uk: {
      ui: {
        run: 'Запустити', stop: 'Стоп', rotate: 'Поворот', delete: 'Видалити',
        save: 'Зберегти', load: 'Завантажити', clear: 'Очистити', language: 'Мова',
        ready: 'Готово', stopped: 'Зупинено', simRunning: 'Симуляція активна',
        placing: 'Розміщення: {name} — клікніть на полотні',
        solveError: "Помилка: коло не вдалося розв'язати (перевірте короткі замикання / джерела)",
        noGround: 'Немає заземлення — вузол 0 використано як плаваючу опору.',
        demoLoaded: 'Демо-схема завантажена. Натисніть «Запустити».',
        simError: 'Помилка симуляції: {msg}',
        confirmClear: 'Очистити все полотно?',
        fileError: 'Помилка файлу: {msg}',
        props_title: 'Властивості', nothing_selected: 'Нічого не вибрано',
        hint: "Перетягніть елемент зліва на полотно. Клік по виводу — з'єднати. Колесо = масштаб, середня кнопка = переміщення.",
        appTitle: 'Лабораторія схем', needHelp: 'Потрібна допомога?', contactFree: 'звертайтеся вільно',
        getSupport: 'Підтримка', theme: 'Тема',
        tip_rotate: 'Поворот (R)', tip_delete: 'Видалити (Del)', tip_save: 'Зберегти', tip_load: 'Завантажити',
        tip_clear: 'Очистити', tip_help: 'Довідка та інструкція'
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
        freq: 'Частота (Гц)', stepBtn: 'Крок', patterns: 'Ряди сигналів', addRow: '+ Додати ряд',
        clearRows: 'Очистити ряди', current: 'Поточний ряд', hex: 'Hex', bits: 'Біти Q15…Q0',
        import: 'Масовий ввід (по рядку: hex або 16-бітний двійковий)', importBtn: 'Імпорт', restart: 'Спочатку'
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
      },
      help: {
        title: 'Довідка та інструкція',
        html: `
          <p><b>SmartOKS Circuit</b> — браузерний симулятор електронних схем для
          збирання та симуляції аналогових і цифрових кіл: джерела, пасивні елементи,
          індикатори, логічні елементи, прилади та лабораторні інструменти.</p>

          <h4>Збирання схеми</h4>
          <ul>
            <li><b>Розмістити</b> — клікніть елемент у лівій панелі, потім клікніть на полотні. Інструмент лишається активним для кількох елементів; <kbd>Esc</kbd> — зупинити.</li>
            <li><b>З'єднати</b> — клікніть вивід (помаранчева крапка), потім інший вивід.</li>
            <li><b>Перемістити</b> — перетягніть елемент. <b>Виділіть</b> елемент, щоб редагувати справа.</li>
            <li><b>Поворот</b> <kbd>R</kbd>, <b>Видалити</b> <kbd>Del</kbd>. Подвійний клік по перемикачу/лог. входу перемикає його.</li>
            <li>Для аналогових кіл додайте <b>Заземлення</b> — це опора 0&nbsp;В.</li>
          </ul>

          <h4>Симуляція</h4>
          <p>Натисніть <b>Запустити</b>. Проводи фарбуються за напругою вузла
          (червоний = +, синій = −), лампи й світлодіоди світяться, прилади показують
          значення, виходи елементів оновлюються. Праворуч — напруга/струм вибраного елемента.</p>

          <h4>Генератор сигналів</h4>
          <p>16 виходів (Q0…Q15). Кожен ряд — 16-бітне слово в <b>hex</b>; клікайте біти
          або вводьте hex, або масово імпортуйте (по рядку: hex / 16-бітний двійковий).
          Режими: <b>Burst</b> (один прохід), <b>Cycle</b> (цикл), <b>Step</b> (вручну).
          Для Burst/Cycle задайте частоту.</p>

          <h4>Логічний аналізатор</h4>
          <p>16 входів (D0…D15). Підключіть сигнали й натисніть «Запустити» — він будує
          живу часову діаграму внизу. Можна змінити вікно часу або очистити запис.</p>

          <h4>Загальне</h4>
          <ul>
            <li><b>Тема</b> — світла / темна у верхній панелі.</li>
            <li><b>Мова</b> — англійська / українська.</li>
            <li><b>Зберегти / Завантажити</b> схеми у JSON; робота також автозберігається локально.</li>
          </ul>
          <p class="help-link">Код і питання:
            <a href="https://github.com/mihasan1/SmartOKS_Circuit" target="_blank" rel="noopener">github.com/mihasan1/SmartOKS_Circuit</a></p>
        `
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
