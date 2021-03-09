import * as utils from "./utils.js";

export class FileLogger {
  private data: number[];

  constructor() {
    this.data = [];
  }

  log(n: number) {
    this.data.push(n);
  }

  download() {
    const fileName = "gb_emu_pc.log";
    const string = this.data.map((n) => utils.hexString(n, 16) + "\n");
    const file = new File(string, fileName, {
      type: "text/plain",
    });

    const tempA = document.createElement("a");
    document.body.appendChild(tempA);
    tempA.style.display = "none";

    const url = URL.createObjectURL(file);
    tempA.href = url;
    tempA.download = fileName;
    tempA.click();
    window.URL.revokeObjectURL(url);
    tempA.remove();
  }
}
