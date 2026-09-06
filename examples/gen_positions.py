# -*- coding: utf-8 -*-
"""生成持仓分析四列示例：sample_positions.xlsx（策略名称、金额、买入净值、当前净值）"""
from openpyxl import Workbook

wb = Workbook()
ws = wb.active
ws.title = "持仓"
ws.append(["策略名称", "金额", "买入净值", "当前净值"])
ws.append(["量化多策略A", 500000, 1.0000, 1.1630])
ws.append(["沪深300增强B", 300000, 2.1000, 2.0322])
ws.append(["CTA趋势C", 200000, 3.5000, 3.7120])
ws.append(["绝对收益D", 150000, 1.2500, 1.2460])
ws.append(["新能源主题E", 100000, 1.8000, 1.3610])
wb.save("sample_positions.xlsx")
print("saved sample_positions.xlsx")
