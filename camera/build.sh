#!/bin/sh
# おかんカメラ（内カメラの見張り）を、自分のMacで組み立て直す
# 「開発元が未確認」で起動できないときや、中身を直したときに使う
set -e
cd "$(dirname "$0")"
mkdir -p OkanCam.app/Contents/MacOS
swiftc -O okancam.swift -o OkanCam.app/Contents/MacOS/okancam
codesign --force -s - OkanCam.app
echo "できたで：$(pwd)/OkanCam.app"
