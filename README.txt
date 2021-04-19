I won't accept contributions at this time. The fun is figuring things out myself!

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
- When clicking on an address (left column), show all ways to get to it (calls and abs/rel jumps)
- Optimize video rendering (cache rendered tiles, maybe selectively update screen)
- Sound

- Interrupts
  - Timer and divider register and corresponding interrupt
  - List:
    - Bit 1: LCD STAT Interrupt Enable  (INT 48h)  (1=Enable) (Remaining: HBlank and VBlank)
    - Bit 2: Timer    Interrupt Enable  (INT 50h)  (1=Enable)
    - Bit 3: Serial   Interrupt Enable  (INT 58h)  (1=Enable)
    - Bit 4: Joypad   Interrupt Enable  (INT 60h)  (1=Enable)

MVC
===
- Model
  - Emu
    - execute instructions -> memory.getInstruction(cpu.PC).execute(cpu, memory)
  - Memory
    - bankToAddressToInstruction
    - disassembleBytes() -> constructs bankToAddressToInstruction
    - getInstruction(address)
    - (getBank(): number)

- Controller
  - Auto update 60 times/s
  - All buttons
  - toUpdate list
    - updatedRegister(reg: number) { this.toUpdate.push(this.registerViews[reg]); }
    - updatedRAM(bank: number, address: number) { this.toUpdate.push(this.memoryViews[bank << 16 + address]); }

- View
  - Clicking on addresses
  - BankView
    - MemoryView (could contain an instruction if aligned)
  - StackView
    - MemoryView
  - RegisterView

Debugging random piece generation bug in Tetris
===============================================
[Log] Rendering 0xfe20 at (128, 112) (video.js, line 124)
[Log] Rendering 0xfe24 at (136, 112) (video.js, line 124)
[Log] Rendering 0xfe28 at (128, 120) (video.js, line 124)
[Log] Rendering 0xfe2c at (136, 120) (video.js, line 124)

0x83 is tile that builds tetris pieces

0xfe20 is the attr for the top right block of the next tetris piece

0xfe20 is written to by 0xffb8, which is a routine copied in high RAM. There should be a loop that copies from one part of memory to 0xfe20.

0xc0: starting DMA transfer of 0xc000-0xc09f to 0xfe00-0xfe9f

0xc020 is the place in memory that's DMA transferred to 0xfe20
