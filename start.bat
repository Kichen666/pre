@echo off
rem Portfolio Compass 看板 —— 一键启动（首次会创建 conda 环境并安装依赖）
chcp 65001 >nul
cd /d %~dp0

where conda >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 conda，请先安装 Anaconda/Miniconda。
  pause
  exit /b 1
)

conda env list | findstr /C:"pc310" >nul 2>nul
if errorlevel 1 (
  echo 首次运行：创建 Python 3.10 环境并安装依赖（约需几分钟）...
  conda create -n pc310 python=3.10 -y
  conda run -n pc310 python -m pip install -r requirements.txt
)

echo 启动本地数据服务...（关闭本窗口即退出）
conda run -n pc310 python server.py
pause
