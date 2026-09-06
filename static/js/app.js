/* ====================================================================
 * Portfolio Compass 看板 —— 前端逻辑（纯本地运行）
 * 数据：行情来自本机 server.py(akshare)，上传的 Excel 与自定义名称
 * 保存在浏览器 localStorage 中。
 * ==================================================================== */
(function () {
  'use strict';

  /* ---------------- 常量 ---------------- */
  var LS_POSITIONS = 'pc_positions_v1';
  var LS_ANALYSIS = 'pc_analysis_v1';
  var LS_MARKET_CACHE = 'pc_market_cache_v1';
  var LS_BASIS_CACHE = 'pc_basis_cache_v1';
  var LS_COMMODITY_CACHE = 'pc_commodity_cache_v1';
  var RF_YEAR = 0.03;        // 无风险利率（年化 3%），仅用于夏普比率
  var TRADING_DAYS = 252;    // 年化用交易日数

  var UP_COLOR = '#e0433f';  // 红
  var DOWN_COLOR = '#0e9f6e';// 绿
  var BLUE = '#2b6cf6';      // 主蓝
  var C = {                  // 浅色主题通用色
    axisLine: '#dfe7f5',
    splitLine: '#eef2fa',
    axisLabel: '#8a94a8',
    tooltipBg: '#ffffff',
    tooltipBorder: '#dfe8f7',
    text: '#16213c',
    toolboxIcon: '#7c879b'
  };

  /* ---------------- 小工具 ---------------- */
  function $(sel) { return document.querySelector(sel); }
  function loadLS(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v === null || v === undefined ? fallback : v;
    } catch (e) { return fallback; }
  }
  function saveLS(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { toast('本地存储空间不足，未能保存', 'error'); }
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtNum(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return Number(v).toFixed(d === undefined ? 2 : d);
  }
  function fmtSignPct(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    var s = Number(v) > 0 ? '+' : '';
    return s + Number(v).toFixed(d === undefined ? 2 : d) + '%';
  }
  function signCls(v) {
    if (v === null || v === undefined || isNaN(v) || v === 0) return 'flat';
    return v > 0 ? 'up' : 'down';
  }

  var toastTimer = null;
  function toast(msg, type) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'show' + (type ? ' ' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, 4000);
  }

  /* ---------------- 右上角时钟 ---------------- */
  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];

  /* 随日期变动的问候语：默认星期问候 + 节气彩蛋（节气日优先展示） */
  var WEEK_GREET = {
    0: '周日好，市场休市，复盘一周',
    1: '周一好，新的一周，先看后动',
    2: '周二好，行情冷暖，数据说话',
    3: '周三好，一周过半，稳字当头',
    4: '周四好，保持耐心，静待花开',
    5: '周五好，周末在望，落袋为安',
    6: '周六好，市场休市'
  };
  /* [节气，月份，21世纪C值，彩蛋文案] 通式寿星公式：日 = ⌊(年%100)×0.2422 + C⌋ - ⌊((年%100)-1)/4⌋ */
  var TERM_TABLE = [
    ['小寒', 1, 5.4055, '今日小寒，天寒地冻，捂好仓位'],
    ['大寒', 1, 20.12, '今日大寒，最冷的时节，静待春来'],
    ['立春', 2, 3.87, '今日立春，万物复苏，春播正当时'],
    ['雨水', 2, 18.73, '今日雨水，润物无声，慢慢加仓'],
    ['惊蛰', 3, 5.63, '今日惊蛰，春雷乍动，万物苏醒'],
    ['春分', 3, 20.646, '今日春分，昼夜平分，盈亏同源'],
    ['清明', 4, 4.81, '今日清明，慎终追远，看清再动'],
    ['谷雨', 4, 20.1, '今日谷雨，雨生百谷，行情滋养'],
    ['立夏', 5, 5.52, '今日立夏，草木葱茏，热情渐起'],
    ['小满', 5, 21.04, '今日小满，小得盈满，知足常乐'],
    ['芒种', 6, 5.678, '今日芒种，忙种忙收，紧握筹码'],
    ['夏至', 6, 21.37, '今日夏至，白昼最长，耐心最长'],
    ['小暑', 7, 7.108, '今日小暑，热浪初至，心静自然凉'],
    ['大暑', 7, 22.83, '今日大暑，酷暑难耐，冷静投资'],
    ['立秋', 8, 7.5, '今日立秋，市场冷静一下'],
    ['处暑', 8, 23.13, '今日处暑，暑气渐消，秋意渐浓'],
    ['白露', 9, 7.646, '今日白露，露白月明，观澜守拙'],
    ['秋分', 9, 23.042, '今日秋分，昼夜平分，攻守平衡'],
    ['寒露', 10, 8.318, '今日寒露，露寒霜降，添衣加仓'],
    ['霜降', 10, 23.438, '今日霜降，草木凝霜，量力而行'],
    ['立冬', 11, 7.438, '今日立冬，万物收藏，收好筹码'],
    ['小雪', 11, 22.36, '今日小雪，初雪轻盈，循序渐进'],
    ['大雪', 12, 7.18, '今日大雪，瑞雪兆丰，厚积薄发'],
    ['冬至', 12, 21.94, '今日冬至，一阳来复，否极泰来']
  ];
  var _termCache = {};
  function solarTerms(year) {
    if (_termCache[year]) return _termCache[year];
    var map = {};
    TERM_TABLE.forEach(function (t) {
      var day = Math.floor((year % 100) * 0.2422 + t[2]) - Math.floor(((year % 100) - 1) / 4);
      map[t[1] + '-' + day] = t[3];
    });
    _termCache[year] = map;
    return map;
  }
  function greetingOf(d) {
    var terms = solarTerms(d.getFullYear());
    return terms[(d.getMonth() + 1) + '-' + d.getDate()] || WEEK_GREET[d.getDay()];
  }

  function startClock() {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    function tick() {
      var d = new Date();
      $('#clock-time').textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
      $('#clock-date').textContent = d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) +
                                     '星期' + WEEK[d.getDay()] + ' · 北京时间';
      $('#greeting').textContent = greetingOf(d);
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------------- 导航 ---------------- */
  var charts = {}; // key -> echarts 实例
  function regChart(key, c) {
    if (charts[key]) { try { charts[key].dispose(); } catch (e) {} }
    charts[key] = c;
  }
  function disposeWithPrefix(prefix) {
    Object.keys(charts).forEach(function (k) {
      if (k.indexOf(prefix) === 0) {
        try { charts[k].dispose(); } catch (e) {}
        delete charts[k];
      }
    });
  }
  function resizeAllCharts() {
    Object.keys(charts).forEach(function (k) {
      try { charts[k].resize(); } catch (e) {}
    });
  }

  var VIEW_META = {
    overview: { k: 'MARKET PULSE', t: '首页概览' },
    position: { k: 'POSITION ANALYSIS', t: '持仓分析' },
    analysis: { k: 'STRATEGY ANALYSIS', t: '策略分析' },
    expert: { k: 'EXPERT VOICE', t: '专家建议' }
  };

  function switchView(name) {
    document.querySelectorAll('.nav-item').forEach(function (b) {
      b.classList.toggle('active', b.dataset.view === name);
    });
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('hidden', v.id !== 'view-' + name);
    });
    var meta = VIEW_META[name] || VIEW_META.overview;
    $('#ph-kicker').textContent = meta.k;
    $('#ph-title').textContent = meta.t;
    requestAnimationFrame(resizeAllCharts);
  }

  /* ================================================================
   * 一、首页概览：市场行情 + 股指期货升贴水率
   * ================================================================ */
  function fetchJSON(url, timeoutMs) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || 180000);
    return fetch(url, { signal: ctrl.signal }).then(function (r) {
      if (!r.ok) throw new Error('接口返回 ' + r.status);
      return r.json();
    }).finally(function () { clearTimeout(timer); });
  }

  function renderMarket(items, ts) {
    var grid = $('#market-grid');
    grid.innerHTML = '';
    if (!items || !items.length) {
      grid.innerHTML = '<div class="muted" style="padding:20px">暂无行情数据（null）</div>';
      return;
    }
    var asof = ts ? ts.slice(0, 10) : null;
    items.forEach(function (it) {
      var card = document.createElement('div');
      card.className = 'idx-cell';
      var bad = (it.price === null || it.price === undefined);
      var chgCls = bad ? 'flat' : signCls(it.change_pct);
      var chgTxt = bad ? 'NULL　NULL' : fmtNum(it.change, 2) + '　' + fmtSignPct(it.change_pct);
      card.innerHTML =
        '<div class="idx-name">' + esc(it.name || 'NULL') + '</div>' +
        '<div class="idx-price' + (bad ? ' nullv' : '') + '">' + (bad ? 'NULL' : fmtNum(it.price, 2)) + '</div>' +
        '<div class="idx-chg ' + chgCls + '">' + chgTxt + '</div>' +
        '<div class="idx-day muted">交易日 ' + (asof || 'NULL') + '</div>';
      grid.appendChild(card);
    });
  }

  function basisChartOption(item) {
    var dates = item.series.map(function (r) { return r.date; });
    var rates = item.series.map(function (r) { return r.rate; });
    var last = item.current;
    var color = (last === null || last === undefined) ? BLUE : (last >= 0 ? UP_COLOR : DOWN_COLOR);
    return {
      animationDuration: 400,
      grid: { left: 44, right: 14, top: 26, bottom: 40 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder,
        textStyle: { color: C.text },
        valueFormatter: function (v) { return fmtNum(v, 3) + '%'; }
      },
      xAxis: {
        type: 'category', data: dates,
        axisLabel: { fontSize: 10, rotate: dates.length > 8 ? 30 : 0, color: C.axisLabel },
        axisLine: { lineStyle: { color: C.axisLine } }
      },
      yAxis: {
        type: 'value', name: '年化 %',
        nameTextStyle: { fontSize: 10, color: C.axisLabel },
        axisLabel: { fontSize: 10, color: C.axisLabel },
        splitLine: { lineStyle: { color: C.splitLine } }
      },
      series: [{
        name: '年化升贴水率', type: 'line', data: rates,
        smooth: true, symbol: 'circle', symbolSize: 5,
        lineStyle: { width: 2, color: color },
        itemStyle: { color: color },
        areaStyle: { color: color, opacity: 0.10 },
        markLine: {
          silent: true, symbol: 'none',
          lineStyle: { type: 'dashed', color: '#5b6b8c' },
          label: { show: false },
          data: [{ yAxis: 0 }]
        }
      }]
    };
  }

  function renderBasis(items) {
    var chips = $('#basis-chips');
    var grid = $('#basis-charts');
    chips.innerHTML = '';
    grid.innerHTML = '';
    disposeWithPrefix('basis-');
    if (!items || !items.length) { grid.innerHTML = '<div class="muted">暂无升贴水数据（null）</div>'; return; }
    items.forEach(function (it) {
      var chip = document.createElement('div');
      chip.className = 'basis-chip';
      chip.innerHTML =
        '<b>' + esc(it.code) + ' ' + esc(it.name) + '</b>' +
        '<span class="val ' + signCls(it.current) + '">' + fmtSignPct(it.current, 3) + '</span>' +
        '<span class="sub">' + esc(it.contract || '当月合约') + ' · 到期 ' + esc(it.expiry || '—') + '</span>';
      chips.appendChild(chip);

      var div = document.createElement('div');
      div.className = 'basis-chart';
      grid.appendChild(div);
      if (!it.series || !it.series.length) {
        div.innerHTML = '<div class="muted" style="padding:30px;text-align:center">暂无数据（null）</div>';
        return;
      }
      var chart = echarts.init(div);
      chart.setOption(basisChartOption(it));
      regChart('basis-' + it.code, chart);
    });
  }

  /* 商品涨跌热力图（有色主力合约 · 方块大小 = 成交量） */
  function renderCommodities(items) {
    var el = $('#commodity-map');
    disposeWithPrefix('commodity-');
    $('#commodity-note').textContent = '';
    if (!items || !items.length) {
      $('#commodity-note').textContent = '暂无商品数据（NULL）';
      return;
    }
    var data = items.map(function (it) {
      var pct = it.change_pct;
      var hasData = (pct !== null && pct !== undefined) || it.price !== undefined;
      var color;
      if (pct === null || pct === undefined) color = '#8a94a8';
      else color = pct > 0 ? '#e0433f' : (pct < 0 ? '#0e9f6e' : '#6b7280');
      var pctText = (pct === null || pct === undefined) ? 'NULL' : fmtSignPct(pct);
      var priceText = (it.price === null || it.price === undefined) ? 'NULL' : fmtNum(it.price);
      var size = (it.volume && it.volume > 0) ? it.volume : 1;
      return {
        name: it.name,
        value: size,
        labelText: it.name + '\n' + pctText,
        priceText: priceText,
        pct: pct,
        volume: it.volume,
        asof: it.asof,
        itemStyle: { color: color, borderColor: '#ffffff', borderWidth: 2, gapWidth: 2 }
      };
    });
    var chart = echarts.init(el);
    chart.setOption({
      tooltip: {
        backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder,
        textStyle: { color: C.text },
        formatter: function (p) {
          var d = p.data;
          return '<b>' + d.name + '</b>（主力连续 ' + esc(d.name) + '）<br>' +
                 '价格：' + d.priceText + '<br>涨跌幅：' +
                 (d.pct === null || d.pct === undefined ? 'NULL' : fmtSignPct(d.pct)) + '<br>成交量(手)：' +
                 (d.volume === null || d.volume === undefined ? 'NULL' : fmtNum(d.volume, 0)) + '<br>收盘日：' +
                 (d.asof || 'NULL');
        }
      },
      series: [{
        type: 'treemap',
        roam: false,
        breadcrumb: { show: false },
        left: 2, right: 2, top: 2, bottom: 2,
        label: {
          show: true,
          fontSize: 13,
          color: '#ffffff',
          fontWeight: 'bold',
          formatter: function (p) { return p.data.labelText; }
        },
        upperLabel: { show: false },
        itemStyle: { borderColor: '#ffffff', borderWidth: 2, gapWidth: 2 },
        data: data
      }]
    });
    regChart('commodity', chart);
    var withData = items.filter(function (it) { return it.price !== null && it.price !== undefined; }).length;
    $('#commodity-note').textContent =
      (withData ? '已加载 ' + withData + ' / ' + items.length + ' 个品种' : '暂无有效数据（NULL）') +
      ' · 口径：主力连续合约最新收盘价与涨跌幅 · 无数据品种显示 NULL';
  }

  function setLoading(on) {
    var btn = $('#btn-refresh');
    btn.disabled = on;
    btn.textContent = on ? '⏳ 刷新中…' : '⟳ 数据刷新';
  }

  function loadOverview(force) {
    setLoading(true);
    var q = force ? '?force=1' : '';
    Promise.all([fetchJSON('/api/market' + q), fetchJSON('/api/basis' + q), fetchJSON('/api/commodities' + q)]).then(function (rs) {
      var md = rs[0], bd = rs[1], cd = rs[2];
      var items = md.items || [];
      var basis = bd.items || [];
      var comm = cd.items || [];
      if (mobileCheck(md) || mobileCheck(bd) || mobileCheck(cd)) {
        toast('行情接口提示：' + (md.error || bd.error || cd.error));
      }
      renderMarket(items, md.ts);
      renderBasis(basis);
      renderCommodities(comm);
      saveLS(LS_MARKET_CACHE, md);
      saveLS(LS_BASIS_CACHE, bd);
      saveLS(LS_COMMODITY_CACHE, cd);
      $('#market-ts').textContent = '数据源 AKShare · 行情时间 ' + (md.ts || '—');
      setLoading(false);
    }).catch(function (err) {
      // 服务不可用 → 展示上次缓存（本地存储）
      var mc = loadLS(LS_MARKET_CACHE, null);
      var bc = loadLS(LS_BASIS_CACHE, null);
      var cc = loadLS(LS_COMMODITY_CACHE, null);
      if (mc && bc && (mc.items && mc.items.length)) {
        renderMarket(mc.items || [], mc.ts);
        renderBasis(bc.items || []);
        renderCommodities(cc ? (cc.items || []) : []);
        $('#market-ts').textContent = '服务不可用，显示本地缓存（' + (mc.ts || '—') + '）';
        toast('无法连接本机数据服务，已显示本地缓存行情', 'warn');
      } else {
        $('#market-grid').innerHTML = '<div class="muted" style="padding:20px">获取行情失败：' + esc(err.message) + '</div>';
        toast('获取行情失败：' + err.message, 'error');
      }
      setLoading(false);
    });
  }
  function mobileCheck(r) { return r && r.ok === false; }

  /* ================================================================
   * 二、Excel 解析与校验（日期、净值 两列）
   * ================================================================ */
  function normHeader(s) {
    return String(s).trim().toLowerCase().replace(/[\s_\-（）()·]/g, '');
  }
  function isDateHeader(s) {
    var t = normHeader(s);
    return t === '日期' || t === 'date' || t === 'date日期' || t === '日期date' ||
           t === '日期时间' || t === '时间' || t === 'dt';
  }
  function isNavHeader(s) {
    var t = normHeader(s);
    return t === '净值' || t === 'nav' || t === 'nav净值' || t === '净值nav' ||
           t.indexOf('单位净值') >= 0 || t.indexOf('累计净值') >= 0;
  }
  function isoDate(d) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function dateFromCell(v) {
    if (v instanceof Date && !isNaN(v.getTime())) return isoDate(v);
    if (typeof v === 'number' && isFinite(v)) {
      // Excel 日期序列号（1900 系统）
      if (v > 20000 && v < 80000) {
        var d = new Date(Math.round((v - 25569) * 86400 * 1000));
        return isoDate(d);
      }
      return null;
    }
    var s = String(v).trim();
    var m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
    if (m) {
      var y = +m[1], mo = +m[2], dd = +m[3];
      if (y > 1970 && y < 2100 && mo >= 1 && mo <= 12 && dd >= 1 && dd <= 31) {
        return y + '-' + (mo < 10 ? '0' : '') + mo + '-' + (dd < 10 ? '0' : '') + dd;
      }
      return null;
    }
    if (/^\d{8}$/.test(s) && s.substring(0, 4) > '1970') {
      return s.substring(0, 4) + '-' + s.substring(4, 6) + '-' + s.substring(6, 8);
    }
    var pd = new Date(s);
    if (!isNaN(pd.getTime())) return isoDate(pd);
    return null;
  }

  /**
   * 解析并校验：必须且只能有【日期、净值】两列。
   * resolve({rows: [{date, nav}], count, fileName})
   */
  function parseNavExcel(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('文件读取失败')); };
      reader.onload = function () {
        try {
          var wb = XLSX.read(new Uint8Array(reader.result), { type: 'array' });
          if (!wb.SheetNames || !wb.SheetNames.length) {
            return reject(new Error('Excel 文件中没有工作表'));
          }
          var ws = wb.Sheets[wb.SheetNames[0]];
          var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

          // 查找表头行
          var hIdx = -1, colDate = -1, colNav = -1;
          for (var i = 0; i < Math.min(aoa.length, 30); i++) {
            var row = aoa[i] || [];
            var dateCol = -1, navCol = -1, nonEmpty = [];
            for (var c = 0; c < row.length; c++) {
              var v = row[c];
              if (v === null || v === undefined || String(v).trim() === '') continue;
              nonEmpty.push(c);
              if (dateCol < 0 && isDateHeader(v)) dateCol = c;
              if (navCol < 0 && isNavHeader(v)) navCol = c;
            }
            if (dateCol >= 0 && navCol >= 0 && dateCol !== navCol) {
              if (nonEmpty.length > 2) {
                return reject(new Error('表头应只包含【日期、净值】两列，当前有 ' + nonEmpty.length + ' 列'));
              }
              hIdx = i; colDate = dateCol; colNav = navCol;
              break;
            }
          }
          if (hIdx < 0) {
            return reject(new Error('格式错误：未找到表头，请使用【日期、净值】两列（表头可为：日期/date、净值/nav）'));
          }

          var rows = [];
          for (var j = hIdx + 1; j < aoa.length; j++) {
            var r = aoa[j] || [];
            var cells = [];
            for (var k = 0; k < r.length; k++) {
              var vv = r[k];
              if (vv !== null && vv !== undefined && String(vv).trim() !== '') cells.push([k, vv]);
            }
            if (!cells.length) continue; // 跳过空行
            for (var t = 0; t < cells.length; t++) {
              if (cells[t][0] !== colDate && cells[t][0] !== colNav) {
                return reject(new Error('第 ' + (j + 1) + ' 行存在多余数据列，请保持【日期、净值】两列格式'));
              }
            }
            var d = dateFromCell(r[colDate]);
            if (!d) return reject(new Error('第 ' + (j + 1) + ' 行日期无法识别：' + esc(String(r[colDate]))));
            var n = Number(r[colNav]);
            if (isNaN(n) || !isFinite(n)) return reject(new Error('第 ' + (j + 1) + ' 行净值不是有效数字：' + esc(String(r[colNav]))));
            if (n <= 0) return reject(new Error('第 ' + (j + 1) + ' 行净值必须大于 0：' + n));
            rows.push({ date: d, nav: n });
          }
          if (rows.length < 2) {
            return reject(new Error('数据不足：至少需要 2 条“日期-净值”记录'));
          }
          rows.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
          resolve({ rows: rows, count: rows.length, fileName: file.name });
        } catch (e) {
          reject(e instanceof Error ? e : new Error('Excel 解析失败：' + e));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  /* ================================================================
   * 三、持仓分析：四列投资数据（策略名称、金额、买入净值、当前净值）
   * → 持仓分布饼图 / 盈亏分布饼图 / 量化私募投资分析报告（本地分析引擎）
   * ================================================================ */
  var posList = loadLS(LS_POSITIONS, []);

  function savePos() { saveLS(LS_POSITIONS, posList); }

  function posOf(it) {
    var units = it.amount / it.buyNav;            // 持有份额
    var curValue = units * it.curNav;             // 当前市值
    var pl = curValue - it.amount;                // 浮动盈亏（元）
    var plPct = it.curNav / it.buyNav - 1;        // 收益率（相对买入净值）
    return { units: units, curValue: curValue, pl: pl, plPct: plPct };
  }

  function fmtMoney(v) {
    if (v === null || v === undefined || isNaN(v)) return 'NULL';
    var neg = Number(v) < 0 ? '-' : '';
    return neg + '¥' + Math.abs(Number(v)).toLocaleString('zh-CN', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  function addPos(name, amount, buyNav, curNav) {
    name = String(name || '').trim();
    if (!name) { toast('策略名称不能为空', 'error'); return false; }
    if (!(amount > 0)) { toast('金额必须为大于 0 的数字', 'error'); return false; }
    if (!(buyNav > 0)) { toast('买入净值必须为大于 0 的数字', 'error'); return false; }
    if (!(curNav > 0)) { toast('当前净值必须为大于 0 的数字', 'error'); return false; }
    posList.push({
      id: 'p' + Date.now() + Math.random().toString(36).slice(2, 7),
      name: name, amount: amount, buyNav: buyNav, curNav: curNav,
      addedAt: Date.now()
    });
    savePos();
    renderPos();
    toast('已添加「' + name + '」');
    return true;
  }

  /* 持仓 Excel 校验：必须且只能 4 列【策略名称、金额、买入净值、当前净值】 */
  function isPosHeader(s, role) {
    var t = normHeader(s);
    if (role === 'name') return t.indexOf('策略') >= 0 || t === 'name' || (t.indexOf('名称') >= 0 && t.indexOf('净值') < 0);
    if (role === 'amount') return t.indexOf('金额') >= 0 || t.indexOf('amount') >= 0 || t.indexOf('投入') >= 0;
    if (role === 'buy') return t.indexOf('买入') >= 0 || t.indexOf('buy') >= 0 || t.indexOf('成本') >= 0;
    if (role === 'cur') {
      return t.indexOf('当前') >= 0 || t.indexOf('current') >= 0 ||
             (t.indexOf('净值') >= 0 && t.indexOf('买入') < 0 && t.indexOf('成本') < 0);
    }
    return false;
  }

  function parsePosExcel(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('文件读取失败')); };
      reader.onload = function () {
        try {
          var wb = XLSX.read(new Uint8Array(reader.result), { type: 'array' });
          if (!wb.SheetNames || !wb.SheetNames.length) return reject(new Error('Excel 文件中没有工作表'));
          var ws = wb.Sheets[wb.SheetNames[0]];
          var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

          var hIdx = -1, cols = { name: -1, amount: -1, buy: -1, cur: -1 };
          for (var i = 0; i < Math.min(aoa.length, 30); i++) {
            var row = aoa[i] || [];
            var nonEmpty = [];
            for (var c = 0; c < row.length; c++) {
              var v = row[c];
              if (v !== null && v !== undefined && String(v).trim() !== '') nonEmpty.push(c);
            }
            if (nonEmpty.length !== 4) continue;
            var cName = -1, cAmount = -1, cBuy = -1, cCur = -1;
            nonEmpty.forEach(function (c) {
              if (cName < 0 && isPosHeader(row[c], 'name')) cName = c;
              else if (cAmount < 0 && isPosHeader(row[c], 'amount')) cAmount = c;
              else if (cBuy < 0 && isPosHeader(row[c], 'buy')) cBuy = c;
              else if (cCur < 0 && isPosHeader(row[c], 'cur')) cCur = c;
            });
            if (cName >= 0 && cAmount >= 0 && cBuy >= 0 && cCur >= 0) {
              hIdx = i; cols = { name: cName, amount: cAmount, buy: cBuy, cur: cCur };
              break;
            }
          }
          if (hIdx < 0) {
            return reject(new Error('格式错误：表头必须为【策略名称、金额、买入净值、当前净值】四列'));
          }
          var rows = [];
          for (var j = hIdx + 1; j < aoa.length; j++) {
            var r = aoa[j] || [];
            var cells = [];
            for (var k = 0; k < r.length; k++) {
              var vv = r[k];
              if (vv !== null && vv !== undefined && String(vv).trim() !== '') cells.push([k, vv]);
            }
            if (!cells.length) continue;
            var ok = cells.every(function (cc) {
              return cc[0] === cols.name || cc[0] === cols.amount || cc[0] === cols.buy || cc[0] === cols.cur;
            });
            if (!ok) return reject(new Error('第 ' + (j + 1) + ' 行存在多余数据列，请保持四列格式'));
            var name = String(r[cols.name] || '').trim();
            var amount = Number(r[cols.amount]);
            var buy = Number(r[cols.buy]);
            var cur = Number(r[cols.cur]);
            if (!name) return reject(new Error('第 ' + (j + 1) + ' 行策略名称不能为空'));
            if (!(amount > 0) || !isFinite(amount)) return reject(new Error('第 ' + (j + 1) + ' 行金额不是有效正数'));
            if (!(buy > 0) || !isFinite(buy)) return reject(new Error('第 ' + (j + 1) + ' 行买入净值不是有效正数'));
            if (!(cur > 0) || !isFinite(cur)) return reject(new Error('第 ' + (j + 1) + ' 行当前净值不是有效正数'));
            rows.push({ name: name, amount: amount, buyNav: buy, curNav: cur });
          }
          if (!rows.length) return reject(new Error('数据不足：至少需要 1 条记录'));
          resolve({ rows: rows, fileName: file.name });
        } catch (e) {
          reject(e instanceof Error ? e : new Error('Excel 解析失败：' + e));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function addPosFiles(files) {
    Array.prototype.forEach.call(files, function (file) {
      parsePosExcel(file).then(function (res) {
        res.rows.forEach(function (r) {
          posList.push({
            id: 'p' + Date.now() + Math.random().toString(36).slice(2, 7),
            name: r.name, amount: r.amount, buyNav: r.buyNav, curNav: r.curNav,
            addedAt: Date.now()
          });
        });
        savePos();
        renderPos();
        toast('已导入「' + file.name + '」，共 ' + res.rows.length + ' 条持仓');
      }).catch(function (e) {
        toast('「' + file.name + '」' + e.message, 'error');
      });
    });
  }

  function posTableRender() {
    var tbody = $('#pos-tbody');
    tbody.innerHTML = '';
    $('#pos-empty').classList.toggle('hidden', posList.length > 0);
    posList.forEach(function (it) {
      var st = posOf(it);
      var cls = st.pl > 0 ? 'up' : (st.pl < 0 ? 'down' : 'flat');
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="pos-name">' + esc(it.name) + '</td>' +
        '<td>' + fmtMoney(it.amount) + '</td>' +
        '<td>' + fmtNum(it.buyNav, 4) + '</td>' +
        '<td>' + fmtNum(it.curNav, 4) + '</td>' +
        '<td class="' + cls + '">' + fmtMoney(st.pl) + '（' + fmtSignPct(st.plPct * 100) + '）</td>' +
        '<td><button class="btn-ghost btn-danger pos-del" data-id="' + it.id + '" title="删除">✕</button></td>';
      tbody.appendChild(tr);
    });
  }

  var POS_COLORS = ['#2b6cf6', '#4f86f7', '#7aa3f9', '#5cc8ff', '#93b7fa', '#3568d8',
                    '#274aa0', '#64b5f6', '#a8c6fc', '#1e40af', '#90bff5', '#3f5fbf'];

  function posChartsRender() {
    disposeWithPrefix('pos-chart-');
    var holdEl = $('#pos-pie-hold');
    var plEl = $('#pos-pie-pl');
    holdEl.innerHTML = '';
    plEl.innerHTML = '';

    if (!posList.length) {
      holdEl.innerHTML = '<div class="muted" style="padding:80px;text-align:center">待录入持仓数据</div>';
      plEl.innerHTML = '<div class="muted" style="padding:80px;text-align:center">待录入持仓数据</div>';
      $('#pos-summary').innerHTML = '';
      return;
    }

    var stats = posList.map(function (it) { return { it: it, st: posOf(it) }; });
    var totalAmount = stats.reduce(function (a, x) { return a + x.it.amount; }, 0);
    var totalCur = stats.reduce(function (a, x) { return a + x.st.curValue; }, 0);
    var totalPl = totalCur - totalAmount;
    var winItems = stats.filter(function (x) { return x.st.pl > 0; });
    var lossItems = stats.filter(function (x) { return x.st.pl < 0; });
    var profitSum = winItems.reduce(function (a, x) { return a + x.st.pl; }, 0);
    var lossSum = lossItems.reduce(function (a, x) { return a - x.st.pl; }, 0);
    var topCur = Math.max.apply(null, stats.map(function (x) { return x.st.curValue; }));
    var topItem = stats.reduce(function (a, x) { return x.st.curValue > a.st.curValue ? x : a; }, stats[0]);

    /* 持仓分布：当前市值占比 */
    var chart1 = echarts.init(holdEl);
    chart1.setOption({
      tooltip: {
        backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder, textStyle: { color: C.text },
        formatter: function (p) {
          var x = stats[p.dataIndex];
          return esc(x.it.name) + '<br>当前市值：' + fmtMoney(x.st.curValue) +
                 '<br>占比：' + Number(p.percent).toFixed(1) + '%<br>投入金额：' + fmtMoney(x.it.amount) +
                 '<br>浮动盈亏：' + fmtMoney(x.st.pl) +
                 '（' + fmtSignPct(x.st.plPct * 100) + '）';
        }
      },
      legend: { bottom: 0, textStyle: { color: C.axisLabel, fontSize: 11 } },
      series: [{
        type: 'pie', radius: ['38%', '60%'], center: ['50%', '44%'],
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: { formatter: '{b}\n{d}%', fontSize: 11, color: C.text },
        data: stats.map(function (x, i) {
          return { name: x.it.name, value: Math.round(x.st.curValue * 100) / 100, itemStyle: { color: POS_COLORS[i % POS_COLORS.length] } };
        })
      }]
    });
    regChart('pos-chart-hold', chart1);

    /* 盈利/亏损分布：浮动盈亏合计 */
    var plData = [];
    if (profitSum > 0) plData.push({ name: '盈利合计（' + winItems.length + ' 个策略）', value: Math.round(profitSum * 100) / 100, itemStyle: { color: '#e0433f' } });
    if (lossSum > 0) plData.push({ name: '亏损合计（' + lossItems.length + ' 个策略）', value: Math.round(lossSum * 100) / 100, itemStyle: { color: '#0e9f6e' } });
    var chart2 = echarts.init(plEl);
    if (!plData.length) {
      plEl.innerHTML = '<div class="muted" style="padding:80px;text-align:center">当前全部持仓盈亏为 0</div>';
    } else {
      chart2.setOption({
        tooltip: {
          backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder, textStyle: { color: C.text },
          formatter: function (p) { return esc(p.name) + '<br>合计：' + fmtMoney(p.value); }
        },
        legend: { bottom: 0, textStyle: { color: C.axisLabel, fontSize: 11 } },
        series: [{
          type: 'pie', radius: ['38%', '60%'], center: ['50%', '44%'],
          itemStyle: { borderColor: '#fff', borderWidth: 2 },
          label: { formatter: '{b}\n{d}%', fontSize: 11, color: C.text },
          data: plData
        }]
      });
      regChart('pos-chart-pl', chart2);
    }

    /* 汇总 */
    var plCls = totalPl > 0 ? 'up' : (totalPl < 0 ? 'down' : 'flat');
    var pctTxt = fmtSignPct(totalCur > 0 ? (totalPl / totalAmount) * 100 : 0);
    $('#pos-summary').innerHTML =
      '<div class="sum-chip"><span>总投入</span><b>' + fmtMoney(totalAmount) + '</b></div>' +
      '<div class="sum-chip"><span>当前市值</span><b>' + fmtMoney(totalCur) + '</b></div>' +
      '<div class="sum-chip"><span>总浮动盈亏</span><b class="' + plCls + '">' + fmtMoney(totalPl) + '（' + pctTxt + '）</b></div>' +
      '<div class="sum-chip"><span>盈利 / 亏损策略</span><b>' + winItems.length + ' / ' + lossItems.length + '</b></div>' +
      '<div class="sum-chip"><span>最大持仓占比</span><b>' + (totalCur > 0 ? (topCur / totalCur * 100).toFixed(1) : '0.0') + '%（' + esc(topItem.it.name) + '）</b></div>' +
      '<div class="sum-chip"><span>持仓数量</span><b>' + posList.length + ' 个</b></div>';
  }

  /* 量化私募投资分析报告：本地分析引擎（异步生成流程） */
  function generatePosReport() {
    var btn = $('#btn-pos-report');
    var wrap = $('#pos-report');
    if (!posList.length) {
      toast('请先录入持仓数据', 'error');
      return;
    }
    if (btn.disabled) return;
    btn.disabled = true;
    var oldText = btn.textContent;
    btn.textContent = '⏳ 分析师生成中…';
    $('#pos-report-note').textContent = '分析引擎生成中，请稍候…';
    wrap.innerHTML = '<div class="muted">正在汇总持仓、计算集中度与盈亏结构…</div>';
    setTimeout(function () {
      wrap.innerHTML = buildPosReport();
      $('#pos-report-note').textContent = '由本机分析引擎生成 · 不构成投资建议';
      btn.disabled = false;
      btn.textContent = oldText;
    }, 700);
  }

  function buildPosReport() {
    var n = posList.length;
    var stats = posList.map(function (it) { return { it: it, st: posOf(it) }; });
    var totalAmount = stats.reduce(function (a, x) { return a + x.it.amount; }, 0);
    var totalCur = stats.reduce(function (a, x) { return a + x.st.curValue; }, 0);
    var totalPl = totalCur - totalAmount;
    var totalPct = totalAmount > 0 ? totalPl / totalAmount : 0;

    var winItems = stats.filter(function (x) { return x.st.pl > 0; }).sort(function (a, b) { return b.st.pl - a.st.pl; });
    var lossItems = stats.filter(function (x) { return x.st.pl < 0; }).sort(function (a, b) { return a.st.pl - b.st.pl; });
    var flatItems = stats.filter(function (x) { return x.st.pl === 0; });
    var profitSum = winItems.reduce(function (a, x) { return a + x.st.pl; }, 0);
    var lossSum = lossItems.reduce(function (a, x) { return a - x.st.pl; }, 0);
    var avgWin = winItems.length ? profitSum / winItems.length : 0;
    var avgLoss = lossItems.length ? lossSum / lossItems.length : 0;
    var plRatio = (avgLoss > 0) ? avgWin / avgLoss : null;

    var rets = stats.map(function (x) { return x.st.plPct; });
    var meanR = rets.reduce(function (a, b) { return a + b; }, 0) / rets.length;
    var sdR = rets.length > 1 ? Math.sqrt(rets.reduce(function (a, v) { return a + (v - meanR) * (v - meanR); }, 0) / (rets.length - 1)) : 0;
    var maxR = Math.max.apply(null, rets);
    var minR = Math.min.apply(null, rets);

    var topItem = stats.reduce(function (a, x) { return x.st.curValue > a.st.curValue ? x : a; }, stats[0]);
    var topShare = totalCur > 0 ? topItem.st.curValue / totalCur : 0;
    var top3 = stats.slice().sort(function (a, b) { return b.st.curValue - a.st.curValue; }).slice(0, 3);
    var top3Share = totalCur > 0 ? top3.reduce(function (a, x) { return a + x.st.curValue; }, 0) / totalCur : 0;

    var risks = [];
    if (topShare > 0.3) risks.push('集中度风险：最大持仓存在重大风险敞口，建议将单一策略权重降至 30% 以下。'.replace('最大持仓存在重大风险敞口', '「' + esc(topItem.it.name) + '」占比 ' + (topShare * 100).toFixed(1) + '%，为组合核心暴露，'));
    if (top3Share > 0.7 && top3Share !== topShare) risks.push('头部集中：前三大持仓占 ' + (top3Share * 100).toFixed(1) + '%，组合 α 来源较为集中。');
    if (lossItems.length > n / 2) risks.push('亏损面：超过半数策略处于浮亏状态，需复核策略底层逻辑与风控阈值。');
    if (lossSum > 0 && profitSum > 0 && plRatio !== null && plRatio < 1) risks.push('盈亏比偏弱：平均亏损大于平均盈利（盈亏比 ' + plRatio.toFixed(2) + '），建议审视止损纪律。');
    if (sdR > 0.15) risks.push('收益离散：各策略收益率标准差达 ' + (sdR * 100).toFixed(1) + '%，风格分化明显，需区分 α 与风格暴露。');

    var tips = [];
    tips.push('定期更新当前净值：净值是风控与再平衡的基础输入，建议至少每交易日更新一次。');
    if (lossItems.length > 0) {
      var worst = lossItems[0];
      tips.push('先处置最弱一环：' + esc(worst.it.name) + ' 浮亏 ' + fmtMoney(worst.st.pl) + '（' + fmtSignPct(worst.st.plPct * 100) + '），建议设定明确止损线并按纪律执行。');
    }
    if (plRatio !== null && plRatio >= 1.5) tips.push('盈亏结构良好（盈亏比 ' + plRatio.toFixed(2) + '），可维持现有结构，坚守“让利润奔跑”的纪律。');
    if (topShare <= 0.3) tips.push('持仓集中度处于舒适区间，保持分散化配置即可，避免追逐单一热点。');
    tips.push('以量化组合视角定期做“业绩归因”，区分策略 alpha、市场 beta 与择时贡献。');

    function listHtml(items, head) {
      if (!items.length) return '';
      var rows = items.slice(0, 3).map(function (x) {
        var cls = head === 'loss' ? 'down' : 'up';
        return '<li><span class="' + cls + '">' + esc(x.it.name) + '</span>：' + fmtMoney(x.st.pl) +
               '（' + fmtSignPct(x.st.plPct * 100) + '）</li>';
      }).join('');
      return rows;
    }

    return '' +
      '<h4>一、组合概览</h4>' +
      '<p>共 ' + n + ' 个策略。总投入 ' + fmtMoney(totalAmount) + '，按当前净值计算持仓市值 ' + fmtMoney(totalCur) +
      '，浮动盈亏 <span class="' + (totalPl > 0 ? 'up' : totalPl < 0 ? 'down' : 'flat') + '">' + fmtMoney(totalPl) +
      '（' + fmtSignPct(totalPct * 100) + '）</span>。</p>' +
      '<h4>二、盈亏结构</h4>' +
      '<p>盈利策略 ' + winItems.length + ' 个（合计 +' + fmtMoney(profitSum).replace('¥', '¥') + '），亏损策略 ' + lossItems.length +
      ' 个（合计 -' + fmtMoney(lossSum) + '），盈亏平衡 ' + flatItems.length + ' 个；平均盈利 ' + fmtMoney(avgWin) +
      '，平均亏损 -' + fmtMoney(avgLoss) + '，盈亏比 ' + (plRatio === null ? '—' : plRatio.toFixed(2)) + '。</p>' +
      '<ul>' + listHtml(winItems, 'win') + '</ul>' +
      '<ul>' + listHtml(lossItems, 'loss') + '</ul>' +
      '<h4>三、分布与集中度</h4>' +
      '<p>最大持仓「' + esc(topItem.it.name) + '」当前市值 ' + fmtMoney(topItem.st.curValue) + '，占比 ' +
      (topShare * 100).toFixed(1) + '%；前三大合计占比 ' + (top3Share * 100).toFixed(1) + '%。策略收益率区间 ' +
      fmtSignPct(minR * 100) + ' ~ ' + fmtSignPct(maxR * 100) + '，均值 ' + fmtSignPct(meanR * 100) +
      '，标准差 ' + (sdR * 100).toFixed(2) + '%。</p>' +
      '<h4>四、风险提示</h4>' +
      '<ul>' + (risks.length ? risks.map(function (r) { return '<li>' + r + '</li>'; }).join('') : '<li>未触发显著风险规则；请持续跟踪净值变化。</li>') + '</ul>' +
      '<h4>五、管理建议（量化私募视角）</h4>' +
      '<ul>' + tips.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' +
      '<p class="report-foot">本报告由本机量化分析引擎依据录入数据自动生成（模拟分析师流程），用于数据盘点与纪律参考，不构成投资建议。</p>';
  }

  function renderPos() {
    posTableRender();
    posChartsRender();
    $('#pos-report').innerHTML = '<div class="muted">持仓数据已更新 —— 点击“生成分析报告”重新产出报告。</div>';
  }

  /* ================================================================
   * 四、策略分析：收益走势 + 总收益/年化/夏普/卡玛/最大回撤/相关系数
   * ================================================================ */
  var analysisList = loadLS(LS_ANALYSIS, []);
  function saveAnalysis() { saveLS(LS_ANALYSIS, analysisList); }

  function mean(arr) { return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length; }
  function std(arr) {
    if (arr.length < 2) return 0;
    var m = mean(arr);
    var v = arr.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (arr.length - 1);
    return Math.sqrt(v);
  }
  function pearson(a, b) {
    var n = Math.min(a.length, b.length);
    if (n < 2) return NaN;
    var ma = mean(a), mb = mean(b);
    var cov = 0, sa = 0, sb = 0;
    for (var i = 0; i < n; i++) {
      var da = a[i] - ma, db = b[i] - mb;
      cov += da * db; sa += da * da; sb += db * db;
    }
    if (sa === 0 || sb === 0) return NaN;
    return cov / Math.sqrt(sa * sb);
  }

  /* 指标：总收益、年化收益、夏普比率、卡玛比率、最大回撤 */
  function metricsOf(data) {
    var n = data.length;
    var navs = data.map(function (p) { return p[1]; });
    var rets = [];
    for (var i = 1; i < n; i++) rets.push(navs[i] / navs[i - 1] - 1);

    var total = navs[n - 1] / navs[0] - 1;
    var annual = rets.length > 0 ? Math.pow(1 + total, TRADING_DAYS / rets.length) - 1 : null;

    var sd = std(rets);
    var sharpe = null;
    if (sd > 0) {
      var avg = mean(rets);
      sharpe = (avg - RF_YEAR / TRADING_DAYS) / sd * Math.sqrt(TRADING_DAYS);
    }

    var peak = navs[0], mdd = 0;
    navs.forEach(function (v) {
      if (v > peak) peak = v;
      var dd = 1 - v / peak;
      if (dd > mdd) mdd = dd;
    });
    var calmar = (mdd > 0 && annual !== null) ? annual / mdd : null;

    return {
      total: total, annual: annual, sharpe: sharpe, calmar: calmar, mdd: -mdd,
      retsCount: rets.length, first: data[0][0], last: data[n - 1][0]
    };
  }

  function addAnalysisFiles(files) {
    Array.prototype.forEach.call(files, function (file) {
      parseNavExcel(file).then(function (res) {
        var base = file.name.replace(/\.[^.]+$/, '');
        analysisList.push({
          id: 'a' + Date.now() + Math.random().toString(36).slice(2, 7),
          name: base,
          fileName: file.name,
          data: res.rows.map(function (r) { return [r.date, r.nav]; }),
          addedAt: Date.now()
        });
        saveAnalysis();
        renderAnalysis();
        toast('已分析「' + base + '」，共 ' + res.count + ' 条记录');
      }).catch(function (e) {
        toast('「' + file.name + '」' + e.message, 'error');
      });
    });
  }

  function analysisChartOption(item, metrics, isModal) {
    var dates = item.data.map(function (p) { return p[0]; });
    var base = item.data[0][1];
    var ret = item.data.map(function (p) { return (p[1] / base - 1) * 100; });
    var opt = {
      animationDuration: 300,
      tooltip: {
        trigger: 'axis',
        backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder,
        textStyle: { color: C.text },
        valueFormatter: function (v) { return fmtNum(v, 3) + '%'; }
      },
      grid: { left: 54, right: 16, top: 34, bottom: isModal ? 70 : 46 },
      xAxis: {
        type: 'category', data: dates,
        axisLabel: { fontSize: 10, rotate: dates.length > 60 ? 30 : 0, color: C.axisLabel },
        axisLine: { lineStyle: { color: C.axisLine } }
      },
      yAxis: {
        type: 'value', name: '收益 %', scale: true,
        nameTextStyle: { fontSize: 10, color: C.axisLabel },
        axisLabel: { fontSize: 10, color: C.axisLabel },
        splitLine: { lineStyle: { color: C.splitLine } }
      },
      dataZoom: [{ type: 'inside', start: 0, end: 100 }],
      toolbox: {
        right: 4,
        iconStyle: { borderColor: C.toolboxIcon },
        emphasis: { iconStyle: { borderColor: BLUE } },
        feature: {
          dataZoom: { show: true, title: { zoom: '放大轴', back: '缩小轴' } },
          restore: { show: true, title: '重置' }
        }
      },
      series: [{
        name: '累计收益', type: 'line', data: ret,
        smooth: true, showSymbol: false,
        lineStyle: { width: 2, color: BLUE },
        itemStyle: { color: BLUE },
        areaStyle: { color: BLUE, opacity: 0.08 },
        markLine: {
          silent: true, symbol: 'none',
          lineStyle: { type: 'dashed', color: '#5b6b8c' },
          data: [{ yAxis: 0 }]
        }
      }]
    };
    if (isModal) {
      opt.dataZoom.push({
        type: 'slider', height: 18, bottom: 12, start: 0, end: 100,
        backgroundColor: 'transparent', borderColor: C.axisLine,
        fillerColor: 'rgba(255,176,0,.18)', handleStyle: { color: BLUE },
        textStyle: { color: C.axisLabel }
      });
      opt.grid.bottom = 72;
    }
    return opt;
  }

  function renderAnalysis() {
    var grid = $('#analysis-grid');
    var empty = $('#analysis-empty');
    var corrBox = $('#corr-box');
    grid.innerHTML = '';
    disposeWithPrefix('analysis-');
    disposeWithPrefix('corr-');

    if (!analysisList.length) {
      empty.classList.remove('hidden');
      corrBox.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');

    analysisList.forEach(function (item) {
      var m = metricsOf(item.data);
      var card = document.createElement('div');
      card.className = 'chart-card';
      var totalCls = m.total >= 0 ? 'up' : 'down';
      var annualCls = m.annual !== null && m.annual >= 0 ? 'up' : 'down';
      card.innerHTML =
        '<div class="chart-card-head">' +
          '<input class="chart-name" value="' + esc(item.name) + '" title="点击修改图表名称">' +
          '<span class="meta muted">' + item.data.length + ' 条</span>' +
          '<button class="btn-ghost act-zoom" title="放大图表">⤢ 放大</button>' +
          '<button class="btn-ghost btn-danger act-del" title="删除">✕</button>' +
        '</div>' +
        '<div class="chart-card-body"></div>' +
        '<table class="metrics-table">' +
          '<tr><td>总收益</td><td class="' + totalCls + '">' + fmtSignPct(m.total * 100) + '</td></tr>' +
          '<tr><td>年化收益</td><td class="' + annualCls + '">' + (m.annual === null ? '—' : fmtSignPct(m.annual * 100)) + '</td></tr>' +
          '<tr><td>夏普比率</td><td>' + fmtNum(m.sharpe, 2) + '</td></tr>' +
          '<tr><td>卡玛比率</td><td>' + fmtNum(m.calmar, 2) + '</td></tr>' +
          '<tr><td>最大回撤</td><td class="' + signCls(m.mdd) + '">' + fmtSignPct(m.mdd * 100) + '</td></tr>' +
          '<tr><td>数据区间</td><td class="muted" style="font-weight:400">' + esc(m.first) + ' ~ ' + esc(m.last) +
            '（' + m.retsCount + ' 日）</td></tr>' +
        '</table>';
      grid.appendChild(card);

      var nameInput = card.querySelector('.chart-name');
      nameInput.addEventListener('change', function () {
        var v = nameInput.value.trim();
        if (v) { item.name = v; saveAnalysis(); renderAnalysis(); }
        else nameInput.value = item.name;
      });
      card.querySelector('.act-zoom').addEventListener('click', function () { openModal(item, 'analysis'); });
      card.querySelector('.act-del').addEventListener('click', function () {
        if (confirm('确定删除「' + item.name + '」？')) {
          analysisList = analysisList.filter(function (x) { return x.id !== item.id; });
          saveAnalysis(); renderAnalysis();
        }
      });

      var chart = echarts.init(card.querySelector('.chart-card-body'));
      chart.setOption(analysisChartOption(item, m, false));
      regChart('analysis-' + item.id, chart);
    });

    renderCorrelation();
  }

  /* 相关系数矩阵（多份净值数据日收益率的皮尔逊相关） */
  function renderCorrelation() {
    var box = $('#corr-box');
    var chartEl = $('#corr-chart');
    if (analysisList.length < 2) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');

    var dateMap = {};
    analysisList.forEach(function (it) {
      it.data.forEach(function (p) {
        if (!dateMap[p[0]]) dateMap[p[0]] = {};
        dateMap[p[0]][it.id] = p[1];
      });
    });
    var dates = Object.keys(dateMap).sort().filter(function (d) {
      var o = dateMap[d];
      return analysisList.every(function (it) { return o[it.id] !== undefined; });
    });

    var rets = {};
    if (dates.length >= 3) {
      analysisList.forEach(function (it) {
        var prev = null, arr = [];
        dates.forEach(function (d) {
          var v = dateMap[d][it.id];
          if (prev !== null) arr.push(v / prev - 1);
          prev = v;
        });
        rets[it.id] = arr;
      });
    }

    var names = analysisList.map(function (it) { return it.name; });
    var data = [];
    for (var i = 0; i < analysisList.length; i++) {
      for (var j = 0; j < analysisList.length; j++) {
        var v;
        if (i === j) v = 1;
        else if (rets[analysisList[i].id] && rets[analysisList[j].id]) {
          v = pearson(rets[analysisList[i].id], rets[analysisList[j].id]);
        }
        data.push([j, i, isNaN(v) ? null : v]);
      }
    }
    var corrChart = echarts.init(chartEl);
    corrChart.setOption({
      tooltip: {
        backgroundColor: C.tooltipBg, borderColor: C.tooltipBorder,
        textStyle: { color: C.text },
        formatter: function (p) {
          if (p.value[2] === null || p.value[2] === undefined) return '数据不足';
          return names[p.value[1]] + ' × ' + names[p.value[0]] + '<br>相关系数：' + Number(p.value[2]).toFixed(4);
        }
      },
      grid: { left: 140, right: 40, top: 20, bottom: 60 },
      xAxis: {
        type: 'category', data: names,
        axisLabel: { fontSize: 11, color: C.axisLabel },
        axisLine: { lineStyle: { color: C.axisLine } }
      },
      yAxis: {
        type: 'category', data: names,
        axisLabel: { fontSize: 11, color: C.axisLabel },
        axisLine: { lineStyle: { color: C.axisLine } }
      },
      visualMap: {
        min: -1, max: 1, calculable: false, orient: 'horizontal',
        left: 'center', bottom: 0, itemWidth: 12, itemHeight: 90,
        textStyle: { color: C.axisLabel },
        inRange: { color: ['#e0433f', '#ffffff', '#2b6cf6'] },
        text: ['1', '-1']
      },
      series: [{
        type: 'heatmap', data: data,
        label: {
          show: true, fontSize: 12, fontWeight: 'bold', color: '#0f172a',
          formatter: function (p) { return p.value[2] === null ? '—' : Number(p.value[2]).toFixed(2); }
        },
        itemStyle: { borderColor: '#ffffff', borderWidth: 1 }
      }]
    });
    regChart('corr', corrChart);
    $('#corr-note').textContent =
      '基于各策略共同交易日（' + dates.length + ' 日）的日收益率计算皮尔逊相关系数；' +
      '两者均涨或均跌时表现为正值，方向相反则为负值。';
  }

  /* ================================================================
   * 五、放大弹窗（可放大/缩小/重置）
   * ================================================================ */
  var modalChart = null;
  var modalItem = null;

  function openModal(item, kind) {
    modalItem = item;
    $('#modal-title').textContent = '[策略分析] ' + item.name;
    $('#modal').classList.remove('hidden');
    var el = $('#modal-chart');
    if (modalChart) { modalChart.dispose(); modalChart = null; }
    modalChart = echarts.init(el);
    var opt = analysisChartOption(item, metricsOf(item.data), true);
    modalChart.setOption(opt);
    regChart('modal', modalChart);
    requestAnimationFrame(function () { modalChart.resize(); });
  }
  function closeModal() {
    $('#modal').classList.add('hidden');
    if (modalChart) {
      try { disposeWithPrefix('modal'); } catch (e) {}
      modalChart = null; modalItem = null;
    }
  }
  function modalZoomRatio(ratio) {
    if (!modalChart) return;
    var dz = modalChart.getOption().dataZoom[0] || { start: 0, end: 100 };
    var start = dz.start === undefined ? 0 : dz.start;
    var end = dz.end === undefined ? 100 : dz.end;
    var mid = (start + end) / 2;
    var half = (end - start) / 2 * ratio;
    half = Math.max(1, Math.min(50, half));
    start = Math.max(0, mid - half);
    end = Math.min(100, mid + half);
    modalChart.dispatchAction({ type: 'dataZoom', start: start, end: end });
  }

  /* ================================================================
   * 六、初始化
   * ================================================================ */
  function bind() {
    document.querySelectorAll('.nav-item').forEach(function (b) {
      b.addEventListener('click', function () { switchView(b.dataset.view); });
    });
    $('#btn-refresh').addEventListener('click', function () { loadOverview(true); });
    $('#btn-pos-upload').addEventListener('click', function () { $('#file-pos').click(); });
    $('#file-pos').addEventListener('change', function () {
      addPosFiles(this.files);
      this.value = '';
    });
    function addPosFromForm() {
      if (addPos($('#pos-name').value, Number($('#pos-amount').value),
                 Number($('#pos-buy').value), Number($('#pos-cur').value))) {
        $('#pos-name').value = ''; $('#pos-amount').value = ''; $('#pos-buy').value = ''; $('#pos-cur').value = '';
        $('#pos-name').focus();
      }
    }
    $('#btn-pos-add').addEventListener('click', addPosFromForm);
    ['pos-name', 'pos-amount', 'pos-buy', 'pos-cur'].forEach(function (id) {
      document.getElementById(id).addEventListener('keydown', function (e) {
        if (e.key === 'Enter') addPosFromForm();
      });
    });
    $('#pos-tbody').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.pos-del') : null;
      if (!btn) return;
      posList = posList.filter(function (x) { return x.id !== btn.dataset.id; });
      savePos();
      renderPos();
      toast('已删除');
    });
    $('#btn-pos-report').addEventListener('click', generatePosReport);
    $('#btn-upload-analysis').addEventListener('click', function () { $('#file-analysis').click(); });
    $('#file-analysis').addEventListener('change', function () {
      addAnalysisFiles(this.files);
      this.value = '';
    });

    $('#modal-zoom-in').addEventListener('click', function () { modalZoomRatio(0.5); });
    $('#modal-zoom-out').addEventListener('click', function () { modalZoomRatio(2); });
    $('#modal-reset').addEventListener('click', function () {
      if (modalChart) modalChart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
    });
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

    window.addEventListener('resize', resizeAllCharts);
  }

  function init() {
    if (typeof echarts === 'undefined') {
      toast('图表库 echarts 加载失败，请检查网络后刷新页面', 'error');
      return;
    }
    if (typeof XLSX === 'undefined') {
      toast('Excel 解析库 xlsx 加载失败，请检查网络后刷新页面', 'error');
    }
    startClock();
    bind();
    renderPos();
    renderAnalysis();
    loadOverview();
  }

  init();
})();
