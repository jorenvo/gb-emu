#!/usr/bin/env bash

pbpaste > mine.txt
meld good.txt <(cut -d ' ' -f 4- mine.txt | grep .)
