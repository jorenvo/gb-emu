import "mocha";
import { JSDOM } from "jsdom";
import * as assert from "assert";

import { Memory } from "./memory";
import { Video } from "./video";

describe("Video subsystem", function () {
  it("should correctly decode tiles", function () {
    const memory = new Memory(new Uint8Array([
      0x5f, 0x3f, 0x3f, 0x5f, // tile 1 row 1 & 2
      0xff, 0xff, 0xff, 0xff, // tile 1 row 3 & 4
      0xff, 0xff, 0xff, 0xff, // tile 1 row 5 & 6
      0xff, 0xff, 0xff, 0xff, // tile 1 row 7 & 8
      0x5f, 0x3f, 0x3f, 0x5f, // tile 2 row 1 & 2
      0xff, 0xff, 0xff, 0xff, // tile 2 row 3 & 4
      0xff, 0xff, 0xff, 0xff, // tile 2 row 5 & 6
      0xff, 0xff, 0xff, 0xff, // tile 2 row 7 & 8
    ]));

    const { document } = new JSDOM("<canvas>").window;
    const canvas = document.getElementsByTagName("canvas")[0];
    const video = new Video(memory, canvas);

    const image = canvas.getContext("2d")!.createImageData(8, 16);
    for (let i = 0; i < image.data.length; i++) {
      assert.equal(image.data[i], 0);
    }

    const colorMap = video.getColorMap();

    const expectedColorsTile = Array(2 * 8 * 8).fill(colorMap[3]); // fill with black (default of canvas)
    // tile 1 first row
    expectedColorsTile[0] = colorMap[0];
    expectedColorsTile[1] = colorMap[1];
    expectedColorsTile[2] = colorMap[2];

    // tile 1 second row
    expectedColorsTile[8] = colorMap[0];
    expectedColorsTile[9] = colorMap[2];
    expectedColorsTile[10] = colorMap[1];

    // tile 2 first row
    expectedColorsTile[64] = colorMap[0];
    expectedColorsTile[65] = colorMap[1];
    expectedColorsTile[66] = colorMap[2];

    expectedColorsTile[72] = colorMap[0];
    expectedColorsTile[73] = colorMap[2];
    expectedColorsTile[74] = colorMap[1];

    video.renderTile(image, 0, 0, 0);
    video.renderTile(image, 16, 0, 8);

    let offset = 0;
    for (const [colorIndex, colorExpected] of expectedColorsTile.entries()) {
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
