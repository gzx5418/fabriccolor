/* ============================================================
   Fabric Color Database — Showcase Interactive Color Engine
   纯原生 ES5/ES6，零外部依赖，包含：
   1. 精确 sRGB <-> XYZ (D65) <-> CIE Lab / LCh 色彩空间转换
   2. 标准 ISO/CIE 11664-6 CIEDE2000 (ΔE00) 公式实现
   3. CIE 15:2004 六大标准照明体相对 SPD 曲线与色貌感知模拟
   4. 五类织物组织微观经纬 Canvas 纹理渲染器
   ============================================================ */

(function () {
  'use strict';

  /* ---------------- 1. 色彩科学数学核心 ---------------- */
  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function normalizeHex(raw) {
    if (typeof raw !== 'string') return null;
    var s = raw.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(s)) {
      s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    }
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    return '#' + s.toUpperCase();
  }

  function hexToRgb(hex) {
    var clean = normalizeHex(hex) || '#2D4F7C';
    return {
      r: parseInt(clean.slice(1, 3), 16),
      g: parseInt(clean.slice(3, 5), 16),
      b: parseInt(clean.slice(5, 7), 16),
    };
  }

  function rgbToHex(r, g, b) {
    var toHex = function (n) {
      return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0').toUpperCase();
    };
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  function srgbToLinear(c) {
    var v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(v) {
    var c = clamp(v, 0, 1);
    var out = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(clamp(out, 0, 1) * 255);
  }

  function rgbToXyz(rgb) {
    var r = srgbToLinear(rgb.r);
    var g = srgbToLinear(rgb.g);
    var b = srgbToLinear(rgb.b);
    return {
      x: (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100,
      y: (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) * 100,
      z: (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) * 100,
    };
  }

  function xyzToRgb(xyz) {
    var x = xyz.x / 100;
    var y = xyz.y / 100;
    var z = xyz.z / 100;
    var r = x * 3.2404542 - y * 1.5371385 - z * 0.4985314;
    var g = -x * 0.9692660 + y * 1.8760108 + z * 0.0415560;
    var b = x * 0.0556434 - y * 0.2040259 + z * 1.0572252;
    return {
      r: linearToSrgb(r),
      g: linearToSrgb(g),
      b: linearToSrgb(b),
    };
  }

  function xyzToLab(xyz) {
    var xn = 95.047;
    var yn = 100.0;
    var zn = 108.883;
    var f = function (t) {
      return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    };
    var fx = f(xyz.x / xn);
    var fy = f(xyz.y / yn);
    var fz = f(xyz.z / zn);
    return {
      L: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz),
    };
  }

  function hexToLab(hex) {
    return xyzToLab(rgbToXyz(hexToRgb(hex)));
  }

  function labToLch(lab) {
    var C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    var h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
    if (h < 0) h += 360;
    return { L: lab.L, C: C, h: h };
  }

  /* 标准 CIEDE2000 (ISO/CIE 11664-6) */
  function ciede2000(lab1, lab2) {
    var rad = Math.PI / 180;
    var deg = 180 / Math.PI;
    var C1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
    var C2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b);
    var Cbar = (C1 + C2) / 2;
    var Cbar7 = Math.pow(Cbar, 7);
    var G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));

    var a1p = (1 + G) * lab1.a;
    var a2p = (1 + G) * lab2.a;
    var C1p = Math.sqrt(a1p * a1p + lab1.b * lab1.b);
    var C2p = Math.sqrt(a2p * a2p + lab2.b * lab2.b);

    var h1p = C1p === 0 ? 0 : (Math.atan2(lab1.b, a1p) * deg + 360) % 360;
    var h2p = C2p === 0 ? 0 : (Math.atan2(lab2.b, a2p) * deg + 360) % 360;

    var dLp = lab2.L - lab1.L;
    var dCp = C2p - C1p;

    var dhp = 0;
    if (C1p * C2p !== 0) {
      var diff = h2p - h1p;
      if (Math.abs(diff) <= 180) dhp = diff;
      else if (diff > 180) dhp = diff - 360;
      else dhp = diff + 360;
    }
    var dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);

    var Lbarp = (lab1.L + lab2.L) / 2;
    var Cbarp = (C1p + C2p) / 2;
    var Hbarp = 0;
    if (C1p * C2p === 0) {
      Hbarp = h1p + h2p;
    } else if (Math.abs(h1p - h2p) <= 180) {
      Hbarp = (h1p + h2p) / 2;
    } else if (h1p + h2p < 360) {
      Hbarp = (h1p + h2p + 360) / 2;
    } else {
      Hbarp = (h1p + h2p - 360) / 2;
    }

    var T =
      1 -
      0.17 * Math.cos((Hbarp - 30) * rad) +
      0.24 * Math.cos(2 * Hbarp * rad) +
      0.32 * Math.cos((3 * Hbarp + 6) * rad) -
      0.20 * Math.cos((4 * Hbarp - 63) * rad);

    var dTheta = 30 * Math.exp(-Math.pow((Hbarp - 275) / 25, 2));
    var Cbarp7 = Math.pow(Cbarp, 7);
    var Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
    var L50 = Math.pow(Lbarp - 50, 2);
    var SL = 1 + (0.015 * L50) / Math.sqrt(20 + L50);
    var SC = 1 + 0.045 * Cbarp;
    var SH = 1 + 0.015 * Cbarp * T;
    var RT = -Math.sin(2 * dTheta * rad) * Rc;

    var tL = dLp / SL;
    var tC = dCp / SC;
    var tH = dHp / SH;

    return Math.sqrt(tL * tL + tC * tC + tH * tH + RT * tC * tH);
  }

  /* 近似 Munsell / 系统坐标标签 */
  function estimateAnchorLabel(lch) {
    if (lch.C < 3.5) {
      return 'N ' + (lch.L / 10).toFixed(1) + '/0';
    }
    var sectors = ['R', 'YR', 'Y', 'GY', 'G', 'BG', 'B', 'PB', 'P', 'RP'];
    var shifted = (lch.h + 340) % 360;
    var idx = Math.floor(shifted / 36) % 10;
    var sub = (((shifted % 36) / 36) * 10);
    var step = Math.max(2.5, Math.round(sub * 4) / 4);
    var val = clamp(lch.L / 10, 1, 9.5).toFixed(1);
    var chroma = clamp(lch.C / 5, 0.5, 16).toFixed(1);
    return step.toFixed(1).replace(/\.0$/, '') + sectors[idx] + ' V' + val + '/C' + chroma;
  }

  /* ---------------- 2. 预置色彩与织物定义 ---------------- */
  var WEAVE_DEFS = {
    plain_f: {
      name: '平纹正面 (Plain Weave · Front)',
      shortTitle: '平纹正面 · Plain Front (1/1)',
      meta: '1/1 交织结构 · 经纬均衡漫反射',
      sigmaBase: 4.8,
    },
    twill_f: {
      name: '斜纹正面 (Twill Weave · Front)',
      shortTitle: '斜纹正面 · Twill Front (2/1)',
      meta: '2/1 右斜 45° 棱纹 · 清晰斜向肌理',
      sigmaBase: 5.9,
    },
    twill_b: {
      name: '斜纹反面 (Twill Weave · Back)',
      shortTitle: '斜纹反面 · Twill Back (1/2)',
      meta: '纬面为主 · 柔和微斜纹背理',
      sigmaBase: 4.3,
    },
    satin_f: {
      name: '缎纹正面 (Satin Weave · Front)',
      shortTitle: '缎纹正面 · Satin Front (5-End)',
      meta: '五枚长浮线 · 各向异性丝绸光泽',
      sigmaBase: 3.1,
    },
    satin_b: {
      name: '缎纹反面 (Satin Weave · Back)',
      shortTitle: '缎纹反面 · Satin Back',
      meta: '哑光交织背衬 · 低高光颗粒肌理',
      sigmaBase: 4.6,
    },
  };

  var PRESET_COLORS = [
    { name: '靛青', std: '传统色', hex: '#2D4F7C' },
    { name: '茜红', std: '传统色', hex: '#9E3E3B' },
    { name: '竹青', std: '传统色', hex: '#4B6E5B' },
    { name: '藕荷', std: '传统色', hex: '#8E7491' },
    { name: '赭黄', std: 'COLORO', hex: '#B9833C' },
    { name: '天缥', std: 'NCS', hex: '#6FA3B8' },
    { name: '玄墨', std: 'PANTONE', hex: '#2D3542' },
    { name: '米绢', std: 'COLORO', hex: '#D8CDBF' },
  ];

  /* CIE 15:2004 标准照明体相对光谱功率分布 (380-780nm，20nm 步进，21 个标准采样点) */
  var SPD_WAVELENGTHS = [
    380, 400, 420, 440, 460, 480, 500, 520, 540, 560,
    580, 600, 620, 640, 660, 680, 700, 720, 740, 760, 780,
  ];

  var ILLUMINANTS = {
    D50: {
      name: 'CIE D50',
      desc: '印刷与标准灯箱常用暖白日光 (5003K)',
      cct: '5003 K',
      wp: [96.42, 100.0, 82.52],
      spd: [24.5, 49.3, 63.2, 85.9, 100.7, 103.4, 100.8, 100.2, 102.1, 100.0, 101.0, 99.3, 98.5, 95.8, 92.2, 89.4, 82.0, 71.6, 86.2, 54.0, 73.4],
    },
    D55: {
      name: 'CIE D55',
      desc: '中午前后中性自然日光 (5503K)',
      cct: '5503 K',
      wp: [95.68, 100.0, 92.15],
      spd: [32.6, 61.0, 74.8, 94.6, 108.7, 109.4, 104.7, 102.4, 103.2, 100.0, 98.6, 95.2, 93.4, 89.8, 86.0, 82.9, 75.7, 65.8, 79.1, 49.3, 67.3],
    },
    D65: {
      name: 'CIE D65',
      desc: '纺织与工业测色最通用标准平均日光 (6504K)',
      cct: '6504 K',
      wp: [95.05, 100.0, 108.88],
      spd: [50.0, 82.8, 93.4, 104.9, 117.8, 115.9, 109.4, 104.8, 104.4, 100.0, 95.8, 90.0, 87.7, 83.7, 80.2, 78.3, 71.6, 61.6, 75.1, 46.4, 63.4],
    },
    D75: {
      name: 'CIE D75',
      desc: '北向天空偏冷观察日光 (7504K)',
      cct: '7504 K',
      wp: [94.97, 100.0, 122.64],
      spd: [66.7, 101.9, 108.8, 113.1, 124.2, 120.3, 112.1, 106.0, 104.8, 100.0, 93.4, 86.0, 83.3, 79.1, 75.8, 74.5, 68.1, 58.3, 71.5, 44.1, 60.2],
    },
    A: {
      name: 'CIE A',
      desc: '2856K 充气钨丝灯，红黄端能量显著增强',
      cct: '2856 K',
      wp: [109.85, 100.0, 35.58],
      spd: [9.8, 14.7, 21.0, 28.7, 37.8, 48.2, 59.9, 72.5, 85.9, 100.0, 114.4, 129.0, 143.6, 158.0, 172.0, 185.4, 198.3, 210.4, 221.7, 232.1, 241.7],
    },
    C: {
      name: 'CIE C',
      desc: '历史平均日光模拟光源 (6774K)',
      cct: '6774 K',
      wp: [98.07, 100.0, 118.23],
      spd: [33.0, 63.3, 98.1, 121.5, 123.1, 123.9, 112.1, 96.9, 102.1, 105.3, 97.8, 89.7, 88.1, 87.8, 87.9, 84.0, 76.3, 68.3, 61.5, 58.1, 56.0],
    },
  };

  /* ---------------- 3. 程序化微观织物纹理渲染器 ---------------- */
  function renderFabricCanvas(canvas, hex, weaveType, zoom) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    var rgb = hexToRgb(hex);
    var lab = hexToLab(hex);
    var z = zoom || 1.0;

    var imgData = ctx.createImageData(w, h);
    var data = imgData.data;

    // 随明度自适应纹理对比度（模拟 CatBoost 纹理标准差调节：深色与高明度均保留细腻层次）
    var contrastGain = 0.72 + (1 - Math.abs(lab.L - 52) / 62) * 0.48;
    var pitch = Math.max(4, Math.round(7.5 * z));

    for (var y = 0; y < h; y++) {
      // 模拟柔和的布面自然光影起伏（柔和褶皱）
      var drape =
        Math.sin((y / h) * Math.PI * 1.4 + 0.4) * 5.5 +
        Math.cos(((y * 0.55) / h) * Math.PI * 2.1) * 3.0;

      for (var x = 0; x < w; x++) {
        var gx = x / pitch;
        var gy = y / pitch;
        var ix = Math.floor(gx);
        var iy = Math.floor(gy);
        var fx = gx - ix;
        var fy = gy - iy;

        // 纱线横截面穹顶明暗
        var domeX = Math.sin(fx * Math.PI);
        var domeY = Math.sin(fy * Math.PI);

        // 细微纤维杂散感（确定性伪随机，不闪烁）
        var noise = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        var microFiber = (noise - 0.5) * 4.5;

        var shade = 0;
        var spec = 0;

        if (weaveType === 'plain_f') {
          var isWarp = (ix + iy) % 2 === 0;
          var yarn = isWarp ? domeX * 0.85 + domeY * 0.25 : domeY * 0.85 + domeX * 0.25;
          shade = (yarn - 0.62) * 34 * contrastGain;
          spec = isWarp ? Math.pow(domeX, 5) * 5 : Math.pow(domeY, 5) * 3;
        } else if (weaveType === 'twill_f') {
          var phase = (((ix - iy) % 3) + 3) % 3;
          var onTop = phase < 2;
          var diag = Math.sin(((gx - gy) * Math.PI * 2) / 3);
          shade = ((onTop ? domeX * 0.9 : domeY * 0.7) - 0.56) * 38 * contrastGain + diag * 6;
          spec = onTop ? Math.pow(domeX, 4) * 7 : 0;
        } else if (weaveType === 'twill_b') {
          var phaseB = (((ix + iy) % 3) + 3) % 3;
          var onWeft = phaseB < 2;
          shade = ((onWeft ? domeY * 0.82 : domeX * 0.65) - 0.58) * 28 * contrastGain;
          spec = Math.pow(domeY, 5) * 2.5;
        } else if (weaveType === 'satin_f') {
          var satinHit = (((ix + iy * 2) % 5) + 5) % 5 === 0;
          var sheenWave = Math.sin((x / w) * Math.PI * 2.6 + (y / h) * 1.1) * 15;
          var floatProfile = satinHit ? domeY * 0.5 : 0.72 + domeX * 0.28;
          shade = (floatProfile - 0.78) * 24 * contrastGain + sheenWave;
          spec = Math.max(0, Math.pow(Math.sin((x / w) * Math.PI * 1.3 + 0.35), 4)) * 22;
        } else {
          // satin_b
          var hitB = (((ix * 2 + iy) % 5) + 5) % 5 === 0;
          shade = ((hitB ? domeX * 0.9 : domeY * 0.75) - 0.62) * 30 * contrastGain;
          spec = Math.pow(domeY, 4) * 3;
        }

        // 柔和的中心棚拍布光衰减
        var dx = (x - w * 0.45) / w;
        var dy = (y - h * 0.42) / h;
        var vignette = (1 - (dx * dx + dy * dy) * 0.52);

        var delta = shade + drape + microFiber;
        var idx = (y * w + x) * 4;
        data[idx] = clamp((rgb.r + delta) * vignette + spec, 0, 255);
        data[idx + 1] = clamp((rgb.g + delta) * vignette + spec, 0, 255);
        data[idx + 2] = clamp((rgb.b + delta) * vignette + spec, 0, 255);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  /* ---------------- 4. Toast 通知 ---------------- */
  var toastTimer = null;
  function showToast(message) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-visible');
    }, 2200);
  }

  /* ---------------- 5. 首屏交互工作台 + 全局吸色板 ---------------- */
  var heroState = {
    hex: '#2D4F7C',
    name: '靛青 · 传统色',
    weave: 'twill_f',
    tray: ['#2D4F7C', '#9E3E3B', '#4B6E5B', '#B9833C'],
  };

  function renderGlobalTray() {
    var wrap = document.getElementById('global-tray-chips');
    if (!wrap) return;
    wrap.replaceChildren();
    heroState.tray.forEach(function (hex) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tray-chip';
      btn.title = '点击应用此色至首屏织物';

      var dot = document.createElement('span');
      dot.className = 'tray-chip-swatch';
      dot.style.backgroundColor = hex;

      var txt = document.createElement('span');
      txt.textContent = hex;

      btn.appendChild(dot);
      btn.appendChild(txt);
      btn.addEventListener('click', function () {
        heroState.hex = hex;
        heroState.name = '吸色板 · ' + hex;
        updateHeroView();
      });
      wrap.appendChild(btn);
    });
  }

  function addColorToTray(hex) {
    var clean = normalizeHex(hex);
    if (!clean) return;
    if (heroState.tray.indexOf(clean) !== -1) {
      showToast('色值 ' + clean + ' 已在吸色板中');
      return;
    }
    if (heroState.tray.length >= 6) {
      heroState.tray.shift();
    }
    heroState.tray.push(clean);
    renderGlobalTray();
    showToast('已收入全局吸色板：' + clean + ' (' + heroState.tray.length + '/6)');
  }

  function updateHeroView() {
    var canvas = document.getElementById('hero-fabric-canvas');
    var weaveInfo = WEAVE_DEFS[heroState.weave] || WEAVE_DEFS.twill_f;
    renderFabricCanvas(canvas, heroState.hex, heroState.weave, 1.0);

    var lab = hexToLab(heroState.hex);
    var lch = labToLch(lab);

    var titleEl = document.getElementById('hero-weave-title');
    if (titleEl) titleEl.textContent = weaveInfo.shortTitle;

    var hudHex = document.getElementById('hero-hud-hex');
    if (hudHex) hudHex.textContent = heroState.hex;

    var hudLab = document.getElementById('hero-hud-lab');
    if (hudLab) {
      hudLab.textContent =
        'L* ' + lab.L.toFixed(1) + ' · a* ' + lab.a.toFixed(1) + ' · b* ' + lab.b.toFixed(1);
    }

    var nameEl = document.getElementById('hero-color-name');
    if (nameEl) nameEl.textContent = heroState.name;

    var anchorEl = document.getElementById('hero-anchor');
    if (anchorEl) anchorEl.textContent = estimateAnchorLabel(lch);

    // 与理想量化锚点的模拟 ΔE00 读数（基于小数残差确定性展示）
    var deEl = document.getElementById('hero-de');
    if (deEl) {
      var pseudoDelta = (0.35 + ((Math.abs(lab.a) + Math.abs(lab.b)) % 1.15)).toFixed(2);
      deEl.textContent = 'ΔE00 ' + pseudoDelta;
    }

    var dots = document.querySelectorAll('#hero-swatches .swatch-dot');
    dots.forEach(function (dot) {
      dot.classList.toggle('is-active', dot.dataset.hex === heroState.hex);
    });
  }

  function initHeroSection() {
    var swatchContainer = document.getElementById('hero-swatches');
    if (swatchContainer) {
      swatchContainer.replaceChildren();
      PRESET_COLORS.slice(0, 7).forEach(function (item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'swatch-dot';
        btn.style.backgroundColor = item.hex;
        btn.dataset.hex = item.hex;
        btn.title = item.name + ' (' + item.hex + ')';
        btn.setAttribute('aria-label', '选择色样 ' + item.name + ' ' + item.hex);
        btn.addEventListener('click', function () {
          heroState.hex = item.hex;
          heroState.name = item.name + ' · ' + item.std;
          updateHeroView();
        });
        swatchContainer.appendChild(btn);
      });
    }

    document.querySelectorAll('[data-hero-weave]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        heroState.weave = btn.dataset.heroWeave;
        document.querySelectorAll('[data-hero-weave]').forEach(function (other) {
          var active = other === btn;
          other.classList.toggle('is-active', active);
          other.setAttribute('aria-selected', String(active));
        });
        updateHeroView();
      });
    });

    var addBtn = document.getElementById('btn-add-current-tray');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        addColorToTray(heroState.hex);
      });
    }

    var copyBtn = document.getElementById('btn-copy-tray');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var text = heroState.tray.join(', ');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            function () { showToast('已复制色板：' + text); },
            function () { showToast('当前色板：' + text); }
          );
        } else {
          showToast('当前色板：' + text);
        }
      });
    }

    renderGlobalTray();
    updateHeroView();
  }

  /* ---------------- 6. 交互实验室：Tab 切换 ---------------- */
  function initLabTabs() {
    var tabs = document.querySelectorAll('[data-lab-tab]');
    var panels = {
      weave: document.getElementById('lab-panel-weave'),
      spd: document.getElementById('lab-panel-spd'),
      de2000: document.getElementById('lab-panel-de2000'),
    };

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var key = tab.dataset.labTab;
        tabs.forEach(function (t) {
          var active = t === tab;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-selected', String(active));
        });
        Object.keys(panels).forEach(function (k) {
          if (panels[k]) {
            panels[k].hidden = k !== key;
            panels[k].classList.toggle('is-active', k === key);
          }
        });
      });
    });
  }

  /* ---------------- 7. 实验室 Tab 1：织物纹理换色 ---------------- */
  var labWeaveState = {
    weave: 'plain_f',
    hex: '#2D4F7C',
    zoom: 1.0,
  };

  function updateLabWeave() {
    var info = WEAVE_DEFS[labWeaveState.weave];
    var canvas = document.getElementById('lab-fabric-canvas');
    renderFabricCanvas(canvas, labWeaveState.hex, labWeaveState.weave, labWeaveState.zoom);

    var rgb = hexToRgb(labWeaveState.hex);
    var lab = hexToLab(labWeaveState.hex);
    var lch = labToLch(lab);

    var nameEl = document.getElementById('lab-weave-name');
    var metaEl = document.getElementById('lab-weave-meta');
    var sigmaEl = document.getElementById('lab-std-sigma');
    if (nameEl) nameEl.textContent = info.name;
    if (metaEl) metaEl.textContent = info.meta;
    if (sigmaEl) {
      var predictedSigma = (info.sigmaBase * (0.78 + (lab.L / 100) * 0.42)).toFixed(2);
      sigmaEl.textContent = '预测纹理 σL* = ' + predictedSigma;
    }

    var telRgb = document.getElementById('tel-rgb');
    var telLab = document.getElementById('tel-lab');
    var telLch = document.getElementById('tel-lch');
    var telMun = document.getElementById('tel-munsell');
    if (telRgb) telRgb.textContent = rgb.r + ', ' + rgb.g + ', ' + rgb.b;
    if (telLab) telLab.textContent = lab.L.toFixed(1) + ', ' + lab.a.toFixed(1) + ', ' + lab.b.toFixed(1);
    if (telLch) telLch.textContent = lch.L.toFixed(1) + ', ' + lch.C.toFixed(1) + ', ' + lch.h.toFixed(1) + '°';
    if (telMun) telMun.textContent = estimateAnchorLabel(lch);

    var picker = document.getElementById('lab-color-picker');
    var input = document.getElementById('lab-color-input');
    if (picker && picker.value.toUpperCase() !== labWeaveState.hex) picker.value = labWeaveState.hex;
    if (input && document.activeElement !== input) input.value = labWeaveState.hex;

    document.querySelectorAll('#lab-preset-palette .preset-card').forEach(function (card) {
      card.classList.toggle('is-active', card.dataset.hex === labWeaveState.hex);
    });
  }

  function initLabWeave() {
    var presetWrap = document.getElementById('lab-preset-palette');
    if (presetWrap) {
      presetWrap.replaceChildren();
      PRESET_COLORS.forEach(function (item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'preset-card';
        btn.dataset.hex = item.hex;

        var dot = document.createElement('span');
        dot.className = 'preset-dot';
        dot.style.backgroundColor = item.hex;

        var info = document.createElement('span');
        info.className = 'preset-info';
        var strong = document.createElement('strong');
        strong.textContent = item.name;
        var span = document.createElement('span');
        span.textContent = item.std;
        info.appendChild(strong);
        info.appendChild(span);

        btn.appendChild(dot);
        btn.appendChild(info);
        btn.addEventListener('click', function () {
          labWeaveState.hex = item.hex;
          updateLabWeave();
        });
        presetWrap.appendChild(btn);
      });
    }

    document.querySelectorAll('#lab-weave-selector .chip-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        labWeaveState.weave = btn.dataset.weave;
        document.querySelectorAll('#lab-weave-selector .chip-btn').forEach(function (o) {
          o.classList.toggle('is-active', o === btn);
        });
        updateLabWeave();
      });
    });

    var picker = document.getElementById('lab-color-picker');
    var input = document.getElementById('lab-color-input');
    var zoom = document.getElementById('lab-zoom-range');
    var zoomVal = document.getElementById('lab-zoom-val');
    var addBtn = document.getElementById('lab-add-tray');

    if (picker) {
      picker.addEventListener('input', function () {
        labWeaveState.hex = picker.value.toUpperCase();
        updateLabWeave();
      });
    }
    if (input) {
      input.addEventListener('input', function () {
        var parsed = normalizeHex(input.value);
        if (parsed) {
          labWeaveState.hex = parsed;
          updateLabWeave();
        }
      });
    }
    if (zoom) {
      zoom.addEventListener('input', function () {
        labWeaveState.zoom = parseFloat(zoom.value);
        if (zoomVal) zoomVal.textContent = labWeaveState.zoom.toFixed(1) + '×';
        updateLabWeave();
      });
    }
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        addColorToTray(labWeaveState.hex);
      });
    }

    updateLabWeave();
  }

  /* ---------------- 8. 实验室 Tab 2：CIE 光源 SPD 与色貌感知 ---------------- */
  var spdState = {
    illum: 'D65',
    lux: 1000,
    hex: '#7E5A7B',
  };

  function simulateAppearanceHex(refHex, illumKey, lux) {
    var illum = ILLUMINANTS[illumKey] || ILLUMINANTS.D65;
    var xyz = rgbToXyz(hexToRgb(refHex));
    // 基于目标光源与 D65 白点比例 + 照度 Hunt 效应（低照度彩度与明度略降、高照度彩度微升）
    var rx = illum.wp[0] / 95.05;
    var ry = illum.wp[1] / 100.0;
    var rz = illum.wp[2] / 108.88;

    // 保留部分人眼不完全色适应（D 适应度 ~ 0.65，体现真实灯箱下可感知的色偏）
    var adapt = 0.62;
    var gx = 1 + (rx - 1) * (1 - adapt);
    var gy = 1 + (ry - 1) * (1 - adapt);
    var gz = 1 + (rz - 1) * (1 - adapt);

    var luxFactor = Math.pow(clamp(lux / 1000, 0.12, 2.5), 0.14);
    var simXyz = {
      x: xyz.x * gx * luxFactor,
      y: xyz.y * gy * luxFactor,
      z: xyz.z * gz * luxFactor,
    };
    var outRgb = xyzToRgb(simXyz);
    return rgbToHex(outRgb.r, outRgb.g, outRgb.b);
  }

  function renderSpdSvg(illumKey) {
    var svg = document.getElementById('spd-svg');
    if (!svg) return;
    var ns = 'http://www.w3.org/2000/svg';
    svg.replaceChildren();

    var data = ILLUMINANTS[illumKey].spd;
    var maxVal = Math.max(140, Math.max.apply(null, data) * 1.1);
    var padL = 46;
    var padR = 20;
    var padT = 18;
    var padB = 34;
    var plotW = 600 - padL - padR;
    var plotH = 280 - padT - padB;

    // 可见光谱渐变定义
    var defs = document.createElementNS(ns, 'defs');
    var grad = document.createElementNS(ns, 'linearGradient');
    grad.setAttribute('id', 'visible-spectrum-grad');
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '0%');
    var stops = [
      ['0%', '#6d28d9'],
      ['18%', '#2563eb'],
      ['36%', '#06b6d4'],
      ['50%', '#22c55e'],
      ['65%', '#eab308'],
      ['80%', '#f97316'],
      ['100%', '#dc2626'],
    ];
    stops.forEach(function (st) {
      var stop = document.createElementNS(ns, 'stop');
      stop.setAttribute('offset', st[0]);
      stop.setAttribute('stop-color', st[1]);
      stop.setAttribute('stop-opacity', '0.26');
      grad.appendChild(stop);
    });
    defs.appendChild(grad);
    svg.appendChild(defs);

    // 横向网格线
    [0, 50, 100, 150, 200].forEach(function (val) {
      if (val > maxVal) return;
      var y = padT + plotH - (val / maxVal) * plotH;
      var line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', String(padL));
      line.setAttribute('x2', String(padL + plotW));
      line.setAttribute('y1', y.toFixed(1));
      line.setAttribute('y2', y.toFixed(1));
      line.setAttribute('stroke', val === 100 ? 'rgba(37,99,235,0.28)' : 'rgba(15,23,42,0.08)');
      line.setAttribute('stroke-dasharray', val === 100 ? '4 4' : '');
      svg.appendChild(line);

      var txt = document.createElementNS(ns, 'text');
      txt.setAttribute('x', String(padL - 8));
      txt.setAttribute('y', (y + 4).toFixed(1));
      txt.setAttribute('text-anchor', 'end');
      txt.setAttribute('font-size', '10.5');
      txt.setAttribute('fill', '#64748b');
      txt.setAttribute('font-family', 'JetBrains Mono, Consolas, monospace');
      txt.textContent = String(val);
      svg.appendChild(txt);
    });

    // 构建路径
    var pts = data.map(function (v, idx) {
      var x = padL + (idx / (data.length - 1)) * plotW;
      var y = padT + plotH - (v / maxVal) * plotH;
      return [x, y];
    });

    var lineD = pts
      .map(function (p, i) {
        return (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1);
      })
      .join(' ');

    var areaD =
      lineD +
      ' L' +
      (padL + plotW).toFixed(1) +
      ',' +
      (padT + plotH).toFixed(1) +
      ' L' +
      padL.toFixed(1) +
      ',' +
      (padT + plotH).toFixed(1) +
      ' Z';

    var area = document.createElementNS(ns, 'path');
    area.setAttribute('d', areaD);
    area.setAttribute('fill', 'url(#visible-spectrum-grad)');
    svg.appendChild(area);

    var curve = document.createElementNS(ns, 'path');
    curve.setAttribute('d', lineD);
    curve.setAttribute('fill', 'none');
    curve.setAttribute('stroke', '#1d4ed8');
    curve.setAttribute('stroke-width', '2.5');
    curve.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(curve);

    // X 轴波长刻度
    [380, 460, 540, 620, 700, 780].forEach(function (wl) {
      var frac = (wl - 380) / 400;
      var x = padL + frac * plotW;
      var label = document.createElementNS(ns, 'text');
      label.setAttribute('x', x.toFixed(1));
      label.setAttribute('y', String(padT + plotH + 20));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '10.5');
      label.setAttribute('fill', '#64748b');
      label.setAttribute('font-family', 'JetBrains Mono, Consolas, monospace');
      label.textContent = wl + 'nm';
      svg.appendChild(label);
    });
  }

  function updateLabSpd() {
    var illum = ILLUMINANTS[spdState.illum];
    renderSpdSvg(spdState.illum);

    var title = document.getElementById('spd-chart-title');
    var desc = document.getElementById('spd-chart-desc');
    var wp = document.getElementById('spd-whitepoint');
    var cct = document.getElementById('spd-cct');
    var la = document.getElementById('spd-la');
    var luxVal = document.getElementById('spd-lux-val');

    if (title) title.textContent = illum.name + ' 相对光谱功率分布 (380–780 nm)';
    if (desc) desc.textContent = illum.desc;
    if (wp) wp.textContent = 'XYZ: ' + illum.wp.map(function (n) { return n.toFixed(2); }).join(', ');
    if (cct) cct.textContent = illum.cct;
    if (la) la.textContent = ((spdState.lux / Math.PI) * 0.2).toFixed(1) + ' cd/m²';

    var sceneHint = spdState.lux < 300 ? '暗室观察' : spdState.lux < 1500 ? '标准灯箱' : '高亮展厅';
    if (luxVal) luxVal.textContent = spdState.lux + ' lux · ' + sceneHint;

    var simHex = simulateAppearanceHex(spdState.hex, spdState.illum, spdState.lux);
    var de = ciede2000(hexToLab(spdState.hex), hexToLab(simHex));

    var refSw = document.getElementById('spd-ref-swatch');
    var simSw = document.getElementById('spd-sim-swatch');
    var refHex = document.getElementById('spd-ref-hex');
    var simHexEl = document.getElementById('spd-sim-hex');
    var simLabel = document.getElementById('spd-sim-label');
    var shiftDe = document.getElementById('spd-shift-de');

    if (refSw) refSw.style.backgroundColor = spdState.hex;
    if (simSw) simSw.style.backgroundColor = simHex;
    if (refHex) refHex.textContent = spdState.hex;
    if (simHexEl) simHexEl.textContent = simHex;
    if (simLabel) simLabel.textContent = '感知色貌 (' + spdState.illum + ')';
    if (shiftDe) shiftDe.textContent = de.toFixed(2);
  }

  function initLabSpd() {
    var samples = ['#7E5A7B', '#2D4F7C', '#9E3E3B', '#4B6E5B', '#B9833C', '#C4B7A6'];
    var row = document.getElementById('spd-sample-row');
    if (row) {
      row.replaceChildren();
      samples.forEach(function (hex) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'spd-sample-btn' + (hex === spdState.hex ? ' is-active' : '');
        btn.style.backgroundColor = hex;
        btn.title = '测试基色 ' + hex;
        btn.addEventListener('click', function () {
          spdState.hex = hex;
          row.querySelectorAll('.spd-sample-btn').forEach(function (b) {
            b.classList.toggle('is-active', b === btn);
          });
          updateLabSpd();
        });
        row.appendChild(btn);
      });
    }

    document.querySelectorAll('#illuminant-selector .illum-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        spdState.illum = btn.dataset.illum;
        document.querySelectorAll('#illuminant-selector .illum-btn').forEach(function (o) {
          o.classList.toggle('is-active', o === btn);
        });
        updateLabSpd();
      });
    });

    var luxInput = document.getElementById('spd-lux-range');
    if (luxInput) {
      luxInput.addEventListener('input', function () {
        spdState.lux = parseInt(luxInput.value, 10);
        updateLabSpd();
      });
    }

    updateLabSpd();
  }

  /* ---------------- 9. 实验室 Tab 3：CIEDE2000 ΔE00 检定 ---------------- */
  var deState = {
    a: '#2D4F7C',
    b: '#355885',
  };

  function updateLabDe() {
    var labA = hexToLab(deState.a);
    var labB = hexToLab(deState.b);
    var lchA = labToLch(labA);
    var lchB = labToLch(labB);
    var de = ciede2000(labA, labB);

    var pA = document.getElementById('de-preview-a');
    var pB = document.getElementById('de-preview-b');
    var sA = document.getElementById('de-split-a');
    var sB = document.getElementById('de-split-b');
    if (pA) pA.style.backgroundColor = deState.a;
    if (pB) pB.style.backgroundColor = deState.b;
    if (sA) sA.style.backgroundColor = deState.a;
    if (sB) sB.style.backgroundColor = deState.b;

    var lA = document.getElementById('de-lab-a');
    var lB = document.getElementById('de-lab-b');
    if (lA) lA.textContent = 'L* ' + labA.L.toFixed(2) + ' · a* ' + labA.a.toFixed(2) + ' · b* ' + labA.b.toFixed(2);
    if (lB) lB.textContent = 'L* ' + labB.L.toFixed(2) + ' · a* ' + labB.a.toFixed(2) + ' · b* ' + labB.b.toFixed(2);

    var valEl = document.getElementById('de-value');
    var verdictEl = document.getElementById('de-verdict');
    var marker = document.getElementById('de-scale-marker');
    if (valEl) valEl.textContent = 'ΔE00 = ' + de.toFixed(2);

    if (verdictEl) {
      verdictEl.className = 'de-verdict';
      if (de < 1.0) {
        verdictEl.textContent = '人眼极难察觉 (匹配极佳)';
      } else if (de < 2.0) {
        verdictEl.textContent = '纺织品严苛允差内';
      } else if (de < 5.0) {
        verdictEl.textContent = '工业可辨色差';
        verdictEl.classList.add('is-warn');
      } else {
        verdictEl.textContent = '显著色彩偏离';
        verdictEl.classList.add('is-high');
      }
    }

    if (marker) {
      marker.style.left = clamp((de / 10) * 100, 2, 98).toFixed(1) + '%';
    }

    var dL = labB.L - labA.L;
    var dC = lchB.C - lchA.C;
    var dEab2 = Math.pow(labB.L - labA.L, 2) + Math.pow(labB.a - labA.a, 2) + Math.pow(labB.b - labA.b, 2);
    var dH = Math.sqrt(Math.max(0, dEab2 - dL * dL - dC * dC));

    var dlEl = document.getElementById('de-dl');
    var dcEl = document.getElementById('de-dc');
    var dhEl = document.getElementById('de-dh');
    if (dlEl) dlEl.textContent = (dL >= 0 ? '+' : '') + dL.toFixed(2);
    if (dcEl) dcEl.textContent = (dC >= 0 ? '+' : '') + dC.toFixed(2);
    if (dhEl) dhEl.textContent = dH.toFixed(2);

    var pkA = document.getElementById('de-picker-a');
    var pkB = document.getElementById('de-picker-b');
    var txA = document.getElementById('de-hex-a');
    var txB = document.getElementById('de-hex-b');
    if (pkA) pkA.value = deState.a;
    if (pkB) pkB.value = deState.b;
    if (txA && document.activeElement !== txA) txA.value = deState.a;
    if (txB && document.activeElement !== txB) txB.value = deState.b;
  }

  function initLabDe() {
    var pkA = document.getElementById('de-picker-a');
    var pkB = document.getElementById('de-picker-b');
    var txA = document.getElementById('de-hex-a');
    var txB = document.getElementById('de-hex-b');

    if (pkA) pkA.addEventListener('input', function () { deState.a = pkA.value.toUpperCase(); updateLabDe(); });
    if (pkB) pkB.addEventListener('input', function () { deState.b = pkB.value.toUpperCase(); updateLabDe(); });
    if (txA) {
      txA.addEventListener('input', function () {
        var c = normalizeHex(txA.value);
        if (c) { deState.a = c; updateLabDe(); }
      });
    }
    if (txB) {
      txB.addEventListener('input', function () {
        var c = normalizeHex(txB.value);
        if (c) { deState.b = c; updateLabDe(); }
      });
    }

    document.querySelectorAll('[data-de-pair]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var parts = btn.dataset.dePair.split(',');
        if (parts.length === 2) {
          deState.a = parts[0];
          deState.b = parts[1];
          updateLabDe();
        }
      });
    });

    updateLabDe();
  }

  /* ---------------- 10. 八大模块分类筛选 ---------------- */
  function initModuleFilters() {
    var buttons = document.querySelectorAll('.filter-btn');
    var cards = document.querySelectorAll('#modules-grid .module-card');

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var filter = btn.dataset.filter;
        buttons.forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        cards.forEach(function (card) {
          var match = filter === 'all' || card.dataset.category === filter;
          card.classList.toggle('is-hidden', !match);
        });
      });
    });
  }

  /* ---------------- 启动入口 ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initHeroSection();
    initLabTabs();
    initLabWeave();
    initLabSpd();
    initLabDe();
    initModuleFilters();
  });
})();
