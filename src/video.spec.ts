import "mocha";
import { JSDOM } from "jsdom";
import * as assert from "assert";

import { Memory } from "./memory";
import { Video } from "./video";

describe("Video subsystem", function () {
  it("should correctly decode tiles", function () {
    const memory = new Memory(new Uint8Array([0x50, 0x30, 0x30, 0x50]));

    const { document } = new JSDOM("<canvas>").window;
    const canvas = document.getElementsByTagName("canvas")[0];
    const video = new Video(memory, canvas);

    const image = canvas.getContext("2d")!.createImageData(8, 2);
    for (let i = 0; i < image.data.length; i++) {
      assert.equal(image.data[i], 0);
    }

    const colorMap = video.getColorMap();

    const expectedColors = [
      // first row
      colorMap[0],
      colorMap[1],
      colorMap[2],
      colorMap[3],
      colorMap[0],
      colorMap[0],
      colorMap[0],
      colorMap[0],
      // second row
      colorMap[0],
      colorMap[2],
      colorMap[1],
      colorMap[3],
      colorMap[0],
      colorMap[0],
      colorMap[0],
      colorMap[0],
    ];

    video.renderTile(image, 0, 0, 0);

    let offset = 0;
    for (const [colorIndex, colorExpected] of expectedColors.entries()) {
      for (let i = 0; i < 4; i++) {
        assert.equal(
          image.data[offset + i],
          colorExpected[i],
          `wrong color at index ${colorIndex}, color should be ${colorExpected} but is ${image.data.slice(
            offset,
            offset + 4
          )}`
        );
      }

      offset += 4;
    }

    // first row
    // assert.equal(image.data[0], 255);
    // assert.equal(image.data[1], 255);
    // assert.equal(image.data[2], 255);
    // assert.equal(image.data[3], 255);

    // assert.equal(image.data[4], 170);
    // assert.equal(image.data[5], 170);
    // assert.equal(image.data[6], 170);
    // assert.equal(image.data[7], 255);

    // assert.equal(image.data[8], 85);
    // assert.equal(image.data[9], 85);
    // assert.equal(image.data[10], 85);
    // assert.equal(image.data[11], 255);

    // assert.equal(image.data[12], 0);
    // assert.equal(image.data[13], 0);
    // assert.equal(image.data[14], 0);
    // assert.equal(image.data[15], 255);

    // second row
  });
});
