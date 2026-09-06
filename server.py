# -*- coding: utf-8 -*-
"""
Portfolio Compass 看板 —— 本地数据服务（仅本机使用）

从 akshare 抓取数据，通过 HTTP 接口提供给前端：
  GET /api/market  当日主要指数行情（上证、深证、创业板、科创板、北证50）
  GET /api/basis   股指期货 IC/IM/IF/IH 当月年化升贴水率及当月每日走势

约定：任何抓取失败或无数据的字段一律返回 null，绝不编造。
启动：python server.py  →  浏览器打开 http://127.0.0.1:8321
"""
import os
import threading
import webbrowser
from datetime import date, datetime, timedelta

from flask import Flask, jsonify, request, send_from_directory

try:
    import akshare as ak
    import pandas as pd
    AK_OK = True
    AK_ERR = ""
except Exception as _exc:  # pragma: no cover
    ak = None
    pd = None
    AK_OK = False
    AK_ERR = str(_exc)

app = Flask(__name__, static_folder="static", static_url_path="/static")

HOST = "127.0.0.1"
PORT = 8321

# ====================================================================
# 市场行情：当日各大指数
# ====================================================================

# id: 东财日线接口用的代码；code: 行情快照里的数字代码；sina: 新浪行情里的代码
INDEXES = [
    {"id": "sh000001", "code": "000001", "sina": "sh000001", "name": "上证指数"},
    {"id": "sz399001", "code": "399001", "sina": "sz399001", "name": "深证成指"},
    {"id": "sz399006", "code": "399006", "sina": "sz399006", "name": "创业板指"},
    {"id": "sh000688", "code": "000688", "sina": "sh000688", "name": "科创50"},
    {"id": "bj899050", "code": "899050", "sina": "bj899050", "name": "北证50"},
]


def _num(v):
    """安全转 float，非法/缺失返回 None"""
    try:
        if v is None:
            return None
        f = float(v)
        if f != f:  # NaN
            return None
        return round(f, 4)
    except Exception:
        return None


def spot_from_em():
    """东方财富：沪深重要指数快照。返回 {数字代码: 记录}"""
    df = ak.stock_zh_index_spot_em(symbol="沪深重要指数")
    if df is None or df.empty:
        return {}
    out = {}
    for _, r in df.iterrows():
        code = str(r.get("代码"))
        out[code] = {
            "name": r.get("名称"),
            "price": _num(r.get("最新价")),
            "change": _num(r.get("涨跌额")),
            "pct": _num(r.get("涨跌幅")),
        }
    return out


def spot_from_sina():
    """新浪：全部指数快照。返回 {sina代码: 记录}"""
    try:
        df = ak.stock_zh_index_spot_sina()
    except Exception:
        return {}
    if df is None or df.empty:
        return {}
    out = {}
    for _, r in df.iterrows():
        code = str(r.get("代码"))
        out[code] = {
            "name": r.get("名称"),
            "price": _num(r.get("最新价")),
            "change": _num(r.get("涨跌额")),
            "pct": _num(r.get("涨跌幅")),
        }
    return out


def daily_fallback(index_id):
    """兜底：日线接口（东财→新浪），取最近两天计算涨跌幅。返回记录或 None"""
    sources = (
        lambda: ak.stock_zh_index_daily_em(symbol=index_id),
        lambda: ak.stock_zh_index_daily(symbol=index_id),
    )
    for src in sources:
        try:
            df = src()
        except Exception:
            continue
        if df is None or len(df) < 2 or "close" not in df.columns:
            continue
        c = pd.to_numeric(df["close"], errors="coerce").dropna()
        if len(c) < 2:
            continue
        last, prev = float(c.iloc[-1]), float(c.iloc[-2])
        if prev == 0:
            continue
        return {
            "name": None,
            "price": round(last, 4),
            "change": round(last - prev, 4),
            "pct": round((last / prev - 1.0) * 100.0, 4),
        }
    return None


def market_items():
    """依次尝试 东财快照 → 新浪快照 → 东财日线，失败的指数返回 null"""
    try:
        em = spot_from_em()
    except Exception:
        em = {}
    try:
        sina = spot_from_sina()
    except Exception:
        sina = {}
    items = []
    for it in INDEXES:
        rec = em.get(it["code"]) or sina.get(it["sina"])
        if rec is None:
            rec = daily_fallback(it["id"])
        if rec is None:
            items.append({
                "id": it["id"], "name": it["name"],
                "price": None, "change": None, "change_pct": None,
            })
        else:
            items.append({
                "id": it["id"], "name": rec["name"] or it["name"],
                "price": rec["price"], "change": rec["change"],
                "change_pct": rec["pct"],
            })
    return items


# ====================================================================
# 股指期货升贴水率（当月合约，年化）
# 年化升贴水率 = (期货收盘价 / 现货收盘价 - 1) × 365 / 距离到期自然日数
# ====================================================================

FUTURES = [
    {"kind": "IC", "name": "中证500", "index": "sh000905"},
    {"kind": "IM", "name": "中证1000", "index": "sh000852"},
    {"kind": "IF", "name": "沪深300", "index": "sh000300"},
    {"kind": "IH", "name": "上证50", "index": "sh000016"},
]

_contract_cache = {}    # (kind, code) -> DataFrame / None
_index_daily_cache = {} # index_id -> DataFrame / None


def third_friday(year, month):
    """某年某月的第三个周五（股指期货最后交易日）"""
    d = date(year, month, 1)
    d += timedelta(days=(4 - d.weekday()) % 7)  # 当月第一个周五
    return d + timedelta(days=14)               # 第三个周五


def front_month(d):
    """同一天可交易的最近月份合约：当月合约到期后切换到下月合约"""
    y, m = d.year, d.month
    if d > third_friday(y, m):
        if m == 12:
            return y + 1, 1
        return y, m + 1
    return y, m


def contract_codes(kind, y, m):
    # 中金所 2025 年起合约代码年份由 2 位改为 4 位，两种格式都尝试
    return ["%s%02d%02d" % (kind, y % 100, m), "%s%04d%02d" % (kind, y, m)]


def futures_daily(kind, y, m):
    """取指定合约的日线，带缓存；返回 (df, code) 或 (None, None)"""
    for code in contract_codes(kind, y, m):
        key = (kind, code)
        if key not in _contract_cache:
            try:
                _contract_cache[key] = ak.futures_zh_daily_sina(symbol=code)
            except Exception:
                _contract_cache[key] = None
        df = _contract_cache[key]
        if df is not None and len(df) > 0:
            return df, code
    return None, None


def index_daily(index_id):
    """现货指数日线（东财→新浪串联，只缓存成功结果，失败时下次重试）"""
    df = _index_daily_cache.get(index_id)
    if df is not None and len(df) > 0:
        return df
    sources = (
        lambda: ak.stock_zh_index_daily_em(symbol=index_id),
        lambda: ak.stock_zh_index_daily(symbol=index_id),
    )
    for src in sources:
        try:
            df = src()
        except Exception:
            df = None
        if df is not None and len(df) > 0 and "close" in df.columns:
            _index_daily_cache[index_id] = df
            return df
    return None


def _day(s):
    """接口日期列 → date；兼容 'YYYY-MM-DD' 与 datetime 对象"""
    try:
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def basis_one(item):
    kind, index_id = item["kind"], item["index"]
    spot = index_daily(index_id)
    if spot is None:
        return {"code": kind, "name": item["name"], "current": None,
                "contract": None, "expiry": None, "series": []}

    spot = spot.copy()
    spot["_d"] = spot["date"].map(_day)
    spot["_c"] = pd.to_numeric(spot["close"], errors="coerce")

    today = date.today()
    month_start = date(today.year, today.month, 1)

    rows, last_contract, last_expiry = [], None, None
    for _, r in spot.iterrows():
        d = r["_d"]
        if d is None or d < month_start or d > today:
            continue
        c = r["_c"]
        if pd.isna(c) or c <= 0:
            continue
        y, m = front_month(d)
        fut, code = futures_daily(kind, y, m)
        if fut is None:
            continue
        expiry = third_friday(y, m)
        days = (expiry - d).days
        if days <= 0:
            continue
        fut = fut.copy()
        fut["_d"] = fut["date"].map(_day)
        fut["_c"] = pd.to_numeric(fut["close"], errors="coerce")
        row = fut[(fut["_d"] == d) & fut["_c"].notna()]
        if row.empty:
            continue
        f = float(row.iloc[0]["_c"])
        rate = (f / c - 1.0) * 365.0 / days * 100.0
        rows.append({"date": d.strftime("%Y-%m-%d"), "rate": round(rate, 4)})
        last_contract = code
        last_expiry = expiry.strftime("%Y-%m-%d")

    rows.sort(key=lambda x: x["date"])
    return {
        "code": kind,
        "name": item["name"],
        "current": rows[-1]["rate"] if rows else None,
        "contract": last_contract,
        "expiry": last_expiry,
        "series": rows,
    }


# ====================================================================
# 商品涨跌热力图：有色金属主力连续合约最新行情
# ====================================================================

# prefix: 新浪主力连续代码（如 CU0）；data: 最新收盘价、涨跌幅、成交量
COMMODITIES = [
    {"prefix": "CU", "name": "沪铜"},
    {"prefix": "AL", "name": "沪铝"},
    {"prefix": "ZN", "name": "沪锌"},
    {"prefix": "PB", "name": "沪铅"},
    {"prefix": "NI", "name": "沪镍"},
    {"prefix": "SN", "name": "沪锡"},
    {"prefix": "AU", "name": "沪金"},
    {"prefix": "AG", "name": "沪银"},
    {"prefix": "SI", "name": "工业硅"},
    {"prefix": "LC", "name": "碳酸锂"},
]


def _null_commodity(item):
    return {"code": item["prefix"] + "0", "name": item["name"],
            "price": None, "change_pct": None, "volume": None, "asof": None}


def commodity_one(item):
    """主力连续合约：取最近两个交易日收盘价计算涨跌幅，成交量为块大小"""
    code = item["prefix"] + "0"
    end = date.today().strftime("%Y%m%d")
    start = (date.today() - timedelta(days=30)).strftime("%Y%m%d")
    try:
        df = ak.futures_main_sina(symbol=code, start_date=start, end_date=end)
    except Exception:
        return _null_commodity(item)
    if df is None or len(df) < 2 or "收盘价" not in df.columns:
        return _null_commodity(item)
    close = pd.to_numeric(df["收盘价"], errors="coerce").dropna()
    if len(close) < 2:
        return _null_commodity(item)
    last, prev = float(close.iloc[-1]), float(close.iloc[-2])
    pct = round((last / prev - 1.0) * 100.0, 4) if prev else None
    vol = pd.to_numeric(df.get("成交量"), errors="coerce")
    volume = int(vol.iloc[-1]) if len(vol) and vol.iloc[-1] == vol.iloc[-1] else None
    asof = str(df["日期"].iloc[-1])[:10]
    return {"code": code, "name": item["name"], "price": round(last, 2),
            "change_pct": pct, "volume": volume, "asof": asof}


def commodity_items():
    return [commodity_one(it) for it in COMMODITIES]


# ====================================================================
# 路由
# ====================================================================

@app.route("/")
def landing():
    """前置主页（视频背景），点击“开始体验”进入 /board 看板"""
    return send_from_directory(app.static_folder, "landing.html")


@app.route("/board")
def board():
    """Portfolio Compass 看板"""
    return send_from_directory(app.static_folder, "index.html")


def _now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _force():
    return request.args.get("force") == "1"


def _cached_or_refresh(cache, ttl_seconds, producer):
    """短期缓存：非强制刷新且缓存未过期时直接返回缓存结果"""
    if not _force() and cache.get("data") is not None:
        age = datetime.now() - cache["ts"]
        if age.total_seconds() < ttl_seconds:
            return jsonify(cache["data"])
    try:
        data = producer()
    except Exception:
        data = None
    if isinstance(data, dict):
        cache["data"] = data
        cache["ts"] = datetime.now()
        return jsonify(data)
    # 抓取失败：退回旧缓存（如果有）
    if cache.get("data") is not None:
        return jsonify(cache["data"])
    return jsonify({"ok": False, "error": "抓取失败", "ts": _now_str(), "items": []})


_market_cache = {"ts": None, "data": None}
_basis_cache = {"ts": None, "data": None}
_commodity_cache = {"ts": None, "data": None}


@app.route("/api/market")
def api_market():
    if not AK_OK:
        return jsonify({"ok": False, "error": "akshare 不可用：" + AK_ERR,
                        "ts": _now_str(), "items": []})

    def _produce():
        try:
            items = market_items()
        except Exception:
            items = [{"id": it["id"], "name": it["name"], "price": None,
                      "change": None, "change_pct": None} for it in INDEXES]
        return {"ok": True, "ts": _now_str(), "items": items}

    return _cached_or_refresh(_market_cache, 120, _produce)


@app.route("/api/basis")
def api_basis():
    if not AK_OK:
        return jsonify({"ok": False, "error": "akshare 不可用：" + AK_ERR,
                        "ts": _now_str(), "items": []})

    def _produce():
        items = []
        for f in FUTURES:
            try:
                items.append(basis_one(f))
            except Exception:
                items.append({"code": f["kind"], "name": f["name"],
                              "current": None, "contract": None, "expiry": None, "series": []})
        return {"ok": True, "ts": _now_str(), "items": items}

    return _cached_or_refresh(_basis_cache, 900, _produce)


@app.route("/api/commodities")
def api_commodities():
    if not AK_OK:
        return jsonify({"ok": False, "error": "akshare 不可用：" + AK_ERR,
                        "ts": _now_str(), "items": []})

    def _produce():
        try:
            items = commodity_items()
        except Exception:
            items = [_null_commodity(it) for it in COMMODITIES]
        return {"ok": True, "ts": _now_str(), "items": items}

    return _cached_or_refresh(_commodity_cache, 300, _produce)


if __name__ == "__main__":
    print("=" * 56)
    print("  Portfolio Compass 看板（本机数据服务）")
    print("  http://%s:%d" % (HOST, PORT))
    print("  数据来源：akshare；失败字段一律返回 null，不编造")
    print("=" * 56)
    if os.environ.get("PC_NO_BROWSER") is None:
        threading.Timer(1.0, lambda: webbrowser.open("http://%s:%d" % (HOST, PORT))).start()
    app.run(host=HOST, port=PORT, debug=False)
