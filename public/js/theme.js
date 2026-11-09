// Farbschema + Hell/Dunkel. Läuft als normales Skript im <head>, damit beim Laden nichts aufblitzt.
// Die Wahl gilt pro Gerät (localStorage), nicht für den ganzen Haushalt.
(function () {
  var COMMON = {
    light: {
      'surface': '#FFFFFF',
      'gold': '#B9812A', 'gold-soft': '#F4E6C8', 'gold-ink': '#845A16',
      'good': '#3F8F6B', 'good-soft': '#D9EFE4', 'good-ink': '#2D6B4F',
      'danger': '#B5482E', 'danger-soft': '#F7DED6',
      'shadow': '0 1px 2px rgba(20,40,50,.06), 0 10px 28px -14px rgba(20,40,50,.22)',
      'shadow-sm': '0 1px 2px rgba(20,40,50,.08)',
    },
    dark: {
      'gold': '#E2B45E', 'gold-soft': '#3A2E12', 'gold-ink': '#E9C47C',
      'good': '#6FC59B', 'good-soft': '#173326', 'good-ink': '#8FD7B2',
      'danger': '#E08867', 'danger-soft': '#3C2417',
      'shadow': '0 1px 2px rgba(0,0,0,.4), 0 14px 34px -16px rgba(0,0,0,.6)',
      'shadow-sm': '0 1px 2px rgba(0,0,0,.4)',
    },
  };

  var PALETTES = {
    lagune: {
      label: 'Lagune', desc: 'Helles Türkis & Blau',
      light: {
        'bg': '#EEF6F6', 'surface-2': '#E3F0F1', 'surface-3': '#D2E6E8',
        'ink': '#1D3238', 'ink-2': '#4D6870', 'ink-3': '#7F979D', 'line': '#D4E5E7', 'line-strong': '#B9D3D7',
        'accent': '#2A9CA3', 'accent-strong': '#1F7F92', 'accent-soft': '#D5EEF0', 'accent-ink': '#F4FCFC',
        'accent-2': '#3A78C2', 'accent-2-soft': '#DDE9F8',
      },
      dark: {
        'bg': '#0F1C20', 'surface': '#16272C', 'surface-2': '#1C3036', 'surface-3': '#243B42',
        'ink': '#E3F1F2', 'ink-2': '#A7C2C6', 'ink-3': '#6F8D93', 'line': '#26414A', 'line-strong': '#335560',
        'accent': '#5CC6CC', 'accent-strong': '#7ED6DB', 'accent-soft': '#173A40', 'accent-ink': '#08262A',
        'accent-2': '#7DAEEB', 'accent-2-soft': '#1D3150',
      },
    },
    fjord: {
      label: 'Fjord', desc: 'Klares Blau',
      light: {
        'bg': '#EEF3FA', 'surface-2': '#E3EBF7', 'surface-3': '#D1DEF1',
        'ink': '#1B2A3D', 'ink-2': '#4A5D75', 'ink-3': '#8090A6', 'line': '#D5E0EF', 'line-strong': '#BACBE3',
        'accent': '#3E7BC4', 'accent-strong': '#2C62A8', 'accent-soft': '#DCE8F7', 'accent-ink': '#F5F9FF',
        'accent-2': '#2A9CA3', 'accent-2-soft': '#D5EEF0',
      },
      dark: {
        'bg': '#0F1622', 'surface': '#172131', 'surface-2': '#1D293C', 'surface-3': '#253349',
        'ink': '#E6EEF8', 'ink-2': '#A9B8CC', 'ink-3': '#718299', 'line': '#283850', 'line-strong': '#34486A',
        'accent': '#7DAEEB', 'accent-strong': '#9DC2F0', 'accent-soft': '#1D3150', 'accent-ink': '#0B1A2E',
        'accent-2': '#5CC6CC', 'accent-2-soft': '#173A40',
      },
    },
    nest: {
      label: 'Nest', desc: 'Salbei & Rosé',
      light: {
        'bg': '#F1F4EC', 'surface-2': '#E9F0E2', 'surface-3': '#DCE6D0',
        'ink': '#25301F', 'ink-2': '#57624C', 'ink-3': '#8B9680', 'line': '#DAE3CD', 'line-strong': '#C4D1B7',
        'accent': '#C1666B', 'accent-strong': '#A84E53', 'accent-soft': '#F4DFDE', 'accent-ink': '#FFF8F6',
        'accent-2': '#5F8552', 'accent-2-soft': '#DEEBD3',
      },
      dark: {
        'bg': '#161C14', 'surface': '#1F2619', 'surface-2': '#252E1D', 'surface-3': '#2D3823',
        'ink': '#EBF0E3', 'ink-2': '#B7C2A9', 'ink-3': '#7E8A70', 'line': '#333F27', 'line-strong': '#41502F',
        'accent': '#E28D91', 'accent-strong': '#EBA5A8', 'accent-soft': '#3B2427', 'accent-ink': '#2A1214',
        'accent-2': '#8FB47B', 'accent-2-soft': '#23301A',
      },
    },
  };

  // ---------- Eigenes Farbschema: aus 4 Wunschfarben alle Tokens ableiten ----------

  function hexToRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(rgb) {
    return '#' + rgb.map(function (x) {
      return ('0' + Math.round(Math.max(0, Math.min(255, x))).toString(16)).slice(-2);
    }).join('').toUpperCase();
  }

  function toHsl(hex) {
    var c = hexToRgb(hex).map(function (x) { return x / 255; });
    var max = Math.max.apply(null, c), min = Math.min.apply(null, c), l = (max + min) / 2, h = 0, s = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === c[0] ? (c[1] - c[2]) / d + (c[1] < c[2] ? 6 : 0) : max === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }

  function hsl(h, s, l) {
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    var k = function (n) { return (n + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); };
    return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
  }

  // t = Anteil von b
  function mix(a, b, t) {
    var x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex(x.map(function (v, i) { return v + (y[i] - v) * t; }));
  }

  function luminance(hex) {
    var c = hexToRgb(hex).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contrast(a, b) {
    var x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  // Farbe so weit abdunkeln (oder aufhellen), bis Text darauf/darin gut lesbar ist.
  function adjustFor(hex, against, ratio, step) {
    var c = toHsl(hex), out = hex;
    for (var i = 0; i < 60 && contrast(out, against) < ratio; i++) {
      c[2] += step;
      if (c[2] <= 0.05 || c[2] >= 0.95) break;
      out = hsl(c[0], c[1], c[2]);
    }
    return out;
  }

  function deriveCustom(c, dark) {
    var A = toHsl(c.accent), A2 = toHsl(c.accent2), B = toHsl(c.bg), S = toHsl(c.surface);
    if (!dark && luminance(c.bg) > 0.35) {
      var soft = mix(c.accent, '#FFFFFF', 0.82), soft2 = mix(c.accent2, '#FFFFFF', 0.82);
      return {
        'bg': c.bg, 'surface': '#FFFFFF', 'surface-2': mix(c.bg, c.surface, 0.5), 'surface-3': c.surface,
        'ink': hsl(A[0], 0.3, 0.15), 'ink-2': hsl(A[0], 0.16, 0.36), 'ink-3': hsl(A[0], 0.1, 0.52),
        'line': mix(c.surface, c.bg, 0.35), 'line-strong': hsl(S[0], S[1], Math.max(0, S[2] - 0.08)),
        'accent': c.accent, 'accent-strong': adjustFor(c.accent, '#FFFFFF', 4.6, -0.02),
        'accent-soft': soft, 'accent-ink': '#FFFFFF',
        'accent-2': adjustFor(c.accent2, soft2, 4.5, -0.02), 'accent-2-soft': soft2,
      };
    }
    var bg = hsl(B[0], Math.min(B[1], 0.35), 0.09);
    return {
      'bg': bg, 'surface': hsl(B[0], Math.min(B[1], 0.3), 0.13), 'surface-2': hsl(B[0], Math.min(B[1], 0.3), 0.16),
      'surface-3': hsl(S[0], Math.min(S[1], 0.3), 0.21),
      'ink': hsl(A[0], 0.25, 0.92), 'ink-2': hsl(A[0], 0.15, 0.72), 'ink-3': hsl(A[0], 0.12, 0.53),
      'line': hsl(B[0], Math.min(B[1], 0.25), 0.22), 'line-strong': hsl(B[0], Math.min(B[1], 0.25), 0.3),
      'accent': adjustFor(hsl(A[0], A[1], 0.62), bg, 4.5, 0.02), 'accent-strong': hsl(A[0], A[1], 0.75),
      'accent-soft': hsl(A[0], Math.min(A[1], 0.45), 0.2), 'accent-ink': hsl(A[0], 0.5, 0.1),
      'accent-2': hsl(A2[0], A2[1], 0.72), 'accent-2-soft': hsl(A2[0], Math.min(A2[1], 0.45), 0.2),
      'surface-dark': true,
    };
  }

  // Die 4 Wunschfarben einer Vorlage – Startpunkt für „Eigenes“.
  function customFrom(id) {
    var p = (PALETTES[id] || PALETTES.lagune).light;
    return { bg: p.bg, accent: p.accent, accent2: p['accent-2'], surface: p['surface-3'] };
  }

  var KEY = 'rezepte-app/theme';
  var media = window.matchMedia('(prefers-color-scheme: dark)');

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }

  function resolve(pref) {
    pref = Object.assign({ palette: 'lagune', mode: 'auto' }, pref || read());
    if (pref.palette === 'custom' && !pref.custom) pref.custom = customFrom('lagune');
    if (pref.palette !== 'custom' && !PALETTES[pref.palette]) pref.palette = 'lagune';
    return pref;
  }

  function tokensFor(pref, dark) {
    if (pref.palette === 'custom') {
      var t = deriveCustom(pref.custom, dark);
      var darkTokens = !!t['surface-dark'];
      delete t['surface-dark'];
      return { tokens: Object.assign({}, COMMON[darkTokens ? 'dark' : 'light'], t), dark: darkTokens };
    }
    var p = PALETTES[pref.palette];
    return { tokens: Object.assign({}, COMMON[dark ? 'dark' : 'light'], dark ? p.dark : p.light), dark: dark };
  }

  function apply(pref) {
    pref = resolve(pref);
    var res = tokensFor(pref, pref.mode === 'dark' || (pref.mode === 'auto' && media.matches));
    var dark = res.dark;
    var tokens = res.tokens;
    var root = document.documentElement;
    for (var k in tokens) root.style.setProperty('--' + k, tokens[k]);
    root.setAttribute('data-mode', dark ? 'dark' : 'light');
    root.setAttribute('data-palette', pref.palette);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', tokens.bg);
  }

  function set(patch) {
    var pref = Object.assign(read(), patch);
    try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch (e) {}
    apply(pref);
  }

  media.addEventListener('change', function () { apply(); });
  apply();
  window.RezepteTheme = {
    PALETTES: PALETTES,
    current: function () { return resolve(); },
    set: set,
    customFrom: customFrom,
    // Für die Einstellungen: wurde die Hauptfarbe für lesbare Button-Schrift abgedunkelt?
    buttonColor: function (c) { return adjustFor(c.accent, '#FFFFFF', 4.6, -0.02); },
    contrast: contrast,
  };
})();
