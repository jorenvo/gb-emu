Useful links
============
https://gbdev.io/list.html
https://gbdev.io/pandocs/

Test CPU
========
https://gbdev.gg8.se/wiki/articles/Test_ROMs

Good games to test (don't use memory banking)
=============================================
- Dr. Mario
- Tetris

Todo
====
- Decide who modifies the PC: abstract instruction, implemented instruction or cpu?
  - Idea: do it in abstract instruction, save PC, run exec, if same then increment, otherwise don't
