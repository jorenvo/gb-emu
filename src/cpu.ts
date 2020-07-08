class CPU {
  AF: number;
  BC: number;
  DE: number;
  HL: number;
  SP: number;
  PC: number;

  memory: Uint8Array;

  constructor(memory: Uint8Array) {
    this.AF = 0;
    this.BC = 0;
    this.DE = 0;
    this.HL = 0;
    this.SP = 0;
    this.PC = 0;
    this.memory = memory;
  }

  run() {
    while (true) {
      let opcode = this.memory[this.PC];
      switch (opcode) {
        case 0x00:
          console.log("No-op");
          return;
          break;
      }
    }
  }
}
