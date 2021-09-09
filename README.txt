I won't accept contributions at this time.

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
