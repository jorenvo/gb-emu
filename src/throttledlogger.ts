class _ThrottledLogger {
  private stackToCounter: Map<string, number>;

  constructor() {
    this.stackToCounter = new Map();
  }

  log(msg: string) {
    let stack = Error().stack!;

    // Only look at the direct parent e.g.:
    // "log@https://localhost:5000/js/throttledlogger.js:6:28
    //  renderTile@https://localhost:5000/js/video.js:86:34"
    stack = stack
      .split("\n")
      .slice(0, 2)
      .join("\n");

    let counter = this.stackToCounter.get(stack);
    if (counter === undefined) {
      console.log(`[throttled] inserting throttled call for:\n${stack}`);
      counter = 0;
    }

    if (counter === 0) {
      console.log(`[throttled] ${msg}`);
    }

    ++counter;
    if (counter === 1_000) {
      counter = 0;
    }

    this.stackToCounter.set(stack, counter);
  }
}

const ThrottledLogger = new _ThrottledLogger();
export default ThrottledLogger;
