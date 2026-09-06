# -*- coding: utf-8 -*-
"""生成示例 Excel：sample_strategy.xlsx / sample_strategy2.xlsx（正确格式）、
sample_wrong.xlsx（错误格式：三列）。运行：python gen_samples.py"""
import random
from datetime import date, timedelta
from openpyxl import Workbook

random.seed(42)


def make(path, n, vol, drift, seed_share, seed):
    rnd = random.Random(seed)
    wb = Workbook()
    ws = wb.active
    ws.title = "净值"
    ws.append(["日期", "净值"])
    r1, acc = [0.0], 0.0
    for _ in range(n):
        acc += rnd.gauss(0, 1)
        r1.append(acc)
    d = date(2024, 1, 2)
    nav = 1.0
    for i in range(n):
        r = rnd.gauss(drift, vol) + seed_share * r1[i]
        nav = max(0.3, nav * (1 + r))
        ws.append([d.strftime("%Y-%m-%d"), round(nav, 4)])
        d += timedelta(days=1)
        if d.weekday() >= 5:
            d += timedelta(days=2 if d.weekday() == 5 else 1)
        if d.day == 1 and d.month != 2:
            d = date(d.year, d.month, 1)  # 简单跳过月末，仅作示例
    wb.save(path)
    print("saved", path)


if __name__ == "__main__":
    make("sample_strategy.xlsx", 160, 0.012, 0.0008, 0.0, 1)
    make("sample_strategy2.xlsx", 160, 0.010, 0.0005, 0.6, 2)

    # 错误格式：三列（应被前端校验拒绝）
    wb = Workbook()
    ws = wb.active
    ws.append(["日期", "净值", "备注"])
    ws.append(["2024-01-02", 1.0, "test"])
    wb.save("sample_wrong.xlsx")
    print("saved sample_wrong.xlsx")
