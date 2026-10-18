@echo off
cd /d "%~dp0"
chcp 65001 >nul
if not exist .env (
  echo DISCORD_TOKEN=cole_o_token_aqui> .env
  echo Criei o arquivo .env. Abra ele, cole o token do bot e rode de novo.
  notepad .env
  pause
  exit /b
)
echo Instalando o discord.py...
py -m pip install -q -U "discord.py>=2.5.2" 2>/dev/null || python -m pip install -q -U "discord.py>=2.5.2"
echo Montando o servidor...
py montar_servidor.py 2>/dev/null || python montar_servidor.py
echo.
echo Terminou. O resumo ficou em resultado.txt
pause
