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
