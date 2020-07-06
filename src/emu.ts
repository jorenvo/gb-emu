const inputElement = document.getElementById("rom")!;
inputElement.addEventListener("change", handleFiles, false);

// Can't use File.arrayBuffer() because it's not supported in Safari
function readFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(evt) {
      resolve(evt.target!.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(file);
  });
}

async function handleFiles(event: Event) {
  const target = event.target as HTMLInputElement;
  const rom = target.files![0];
  console.log(rom);

  const bytes = await readFile(rom);
  console.log(bytes);
}
