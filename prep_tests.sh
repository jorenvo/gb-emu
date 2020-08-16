#!/usr/bin/env bash
set -euo pipefail

cp -r $PWD/src $PWD/test_src
sed -ie 's/^\(import.*\)"\(.*\)\.js"/\1"\2"/g' $PWD/test_src/*.ts
