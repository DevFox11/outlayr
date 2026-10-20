#!/bin/sh
# render.sh page.html W H out.png
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 \
  --window-size="$2,$3" --virtual-time-budget=15000 --allow-file-access-from-files --enable-unsafe-swiftshader \
  --screenshot="$4" "file://$PWD/$1" 2>/dev/null
