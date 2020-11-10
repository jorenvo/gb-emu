export class Loader {
  readFile: Promise<Uint8Array>;

  constructor() {
    this.readFile = new Promise(resolutionFunction => {
      const inputElement = document.getElementById("rom")!;

      inputElement.addEventListener(
        "change",
        (event: Event) => {
          this.handleChangeEvent(event).then(resolutionFunction);
        },
        false
      );
    });
  }

  // Can't use File.arrayBuffer() because it's not supported in Safari
  handleChangeEvent(event: Event): Promise<Uint8Array> {
    const target = event.target as HTMLInputElement;
    const file = target.files![0];

    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = function(event) {
        const buffer = event.target!.result as ArrayBuffer;
        resolve(new Uint8Array(buffer));
      };
      reader.readAsArrayBuffer(file);
    });
  }
}
