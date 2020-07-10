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

  // 4 msb between [1001, 1111] (except HALT: 0x76)
  run() {
    console.log(this.memory.length);
    while (true) {
      if (this.PC >= this.memory.length) {
        console.log("Trying to read outside of memory, stopping CPU.");
        break;
      }

      const byte = this.memory[this.PC];

      if (byte === 0x00) {
        console.log("No-op");
        this.PC += 1;
      } else {
        const twoMSBs = this.getBits(byte, 7, 8);
        if (twoMSBs == 0b01) {
          const registerA = this.getBits(byte, 3, 5);
          const registerB = this.getBits(byte, 0, 2);

          console.log(`copy ${registerA} -> ${registerB}`);
        } else {
          console.log("Unknown instruction");
        }

        this.PC += 1;
      }
    }
  }
}
