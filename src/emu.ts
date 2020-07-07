const inputElement = document.getElementById("rom")!;
inputElement.addEventListener("change", handleFiles, false);

logToConsole("Console");

function formatArrayAsHex(array: Uint8Array): string {
  return array
    .reduce(
      (prev: string, current: number) => prev + current.toString(16) + " ",
      ""
    )
    .trimEnd();
}

// Can't use File.arrayBuffer() because it's not supported in Safari
function readFile(file: File): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(event) {
      const buffer = event.target!.result as ArrayBuffer;
      resolve(new Uint8Array(buffer));
    };
    reader.readAsArrayBuffer(file);
  });
}

function logToConsole(msg: string) {
  let console = document.getElementById("console")!;
  console.innerText += msg;
}

async function handleFiles(event: Event) {
  const target = event.target as HTMLInputElement;
  const rom = target.files![0];
  console.log(rom);

  const bytes = await readFile(rom);
  const nintendoLogo = bytes.slice(0x104, 0x133 + 1);
  logToConsole(`Nintendo logo: ${formatArrayAsHex(nintendoLogo)}`);
}
