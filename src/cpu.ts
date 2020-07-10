export class CPU {
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

  // 0b10101010
  //   ^      ^
  //  to:7 from:0
  getBits(byte: number, from: number, to: number): number {
    const length = to - from;
    const mask = (1 << (length + 1)) - 1;
    return (byte >> from) & mask;
  }

  binString(x: number): string {
    let bin = x.toString(2);
    bin = bin.padStart(8, "0");
    return `0b${bin}`;
  }

  logUnknownInstruction(byte: number) {
    console.log(`unknown instruction ${this.binString(byte)}`);
  }

  // 4 msb between [1001, 1111] (except HALT: 0x76)
  run() {
    console.log(this.memory.length);
    while (true) {
      if (this.PC >= this.memory.length) {
        console.log("Trying to read outside of memory, stopping CPU.");
        break;
      }

      const byte = this.memory[this.PC++];

      const twoMSBs = this.getBits(byte, 7, 8);
      switch (twoMSBs) {
        case 0b00:
          if (byte === 0) {
            console.log("No-op");
          } else if (byte === 0b00110110) {
            // LD (HL), n
            const immediate = this.memory[this.PC++];
            console.log(
              `Load to the address specified in HL the immediate ${immediate}`
            );
          } else if (byte === 0b00001010) {
            // LD A, (BC)
            console.log(
              "Load to the 8-bit A register, data from the absolute address specified by the 16-bit register BC."
            );
          } else if (byte === 0b00011010) {
            // LD A, (DE)
            console.log(
              "Load to the 8-bit A register, data from the absolute address specified by the 16-bit register DE."
            );
          } else if (this.getBits(byte, 0, 2) === 0b110) {
            const immediate = this.memory[this.PC++];
            const registerA = this.getBits(byte, 3, 5);

            // LD r, n
            console.log(`copy immediate ${immediate} into ${registerA}`);
          } else {
            this.logUnknownInstruction(byte);
          }
          break;
        case 0b01:
          const registerA = this.getBits(byte, 3, 5);
          const registerB = this.getBits(byte, 0, 2);

          if (registerB === 0b110) {
            // LD r, (HL)
            console.log(
              `copy from the address specified in 16 bit register HL into ${registerA}`
            );
          } else if (this.getBits(byte, 3, 7) === 0b01110) {
            // LD (HL), r
            console.log(
              `Copy the 8 bit value from register ${registerB} into the address specified in HL`
            );
          } else {
            // LD r, r’
            console.log(`copy ${registerA} -> ${registerB}`);
          }
          break;
        default:
          this.logUnknownInstruction(byte);
      }
    }
  }
}
