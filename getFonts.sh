#!/bin/bash
mkdir -p assets/fonts && cd assets/fonts

#Noto Sans
mkdir -p "Noto Sans" && cd "Noto Sans"
curl "https://raw.githubusercontent.com/googlefonts/noto-fonts/master/hinted/NotoSans/NotoSans-Regular.ttf" -o "NotoSans-normal.ttf"
curl "https://raw.githubusercontent.com/googlefonts/noto-emoji/master/fonts/NotoColorEmoji.ttf" -o "NotoColorEmoji-normal.ttf"
curl "https://raw.githubusercontent.com/googlefonts/noto-cjk/master/NotoSansCJK-Regular.ttc" -o "NotoSansCJK-normal.ttc"
curl "https://raw.githubusercontent.com/googlefonts/noto-fonts/master/LICENSE" -o "LICENSE"
cd ..

cd ../..
