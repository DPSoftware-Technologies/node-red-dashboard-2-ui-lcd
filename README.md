# Character LCD and Graphic LCD for Node-Red Dashboard 2

This repository contain a Character LCD node and a Graphic LCD node for Node-RED Dashboard 2. These nodes add LCD displays to your dashboard ui.

![image](https://github.com/user-attachments/assets/a381a668-ec34-4096-a500-2dd6a1a12df3)
![image](https://github.com/user-attachments/assets/e142e841-ca8b-4856-9a5c-ee66ab31e440)


# Features
- Realtime dynamic update
- **ui-lcd**: Character LCD (Hitachi HD44780 style) with Unicode mapping to the ROM font
- **ui-glcd**: Graphic LCD, a pixel matrix like the 128x64 modules, with optional grayscale
- Draw pixels, lines, rectangles, circles, text and bitmaps with messages
- Backlight on/off, contrast, brightness and colors from messages
- Customizable characters
- Dashboards opened later show the same picture

# Configuration

![image](https://github.com/user-attachments/assets/94f823b0-55e8-45f9-b0db-bf8400fae138)

Both nodes:

- Pixel Size: Set Size per pixel in LCD.
- Space Size: Set space size between pixel in LCD.
- Backlight Color: Set Backlight color in LCD (Pixel off).
- Pixel Color: Set Color of pixel in LCD (Pixel on)
- Block Color: Color of the unlit pixels at maximum contrast. Default: the pixel color for dark-on-light displays, or black for light-on-dark displays.
- Backlight On: Backlight state at start.
- Brightness: Brightness with the backlight on, from 0 (black) to 1 (full colors).
- Dim: Brightness with the backlight off, from 0 (black) to 1 (full colors).
- Contrast: From 0 to 1, like the contrast potentiometer on the real module. At 0.5 the colors are shown as is, lower fades the pixels out, higher makes the unlit pixels visible.
- Auto Clear: Clear the display before every message that draws something.
- ROM: Set ROM of LCD. **JP** for Japanese standard font, or **EU** for European standard font.
- Transition Duration (1.2+): Set Blur for pixel transition.

Character LCD only:

- Rows: Set rows of LCD.
- Columns: Set columns of LCD.

Graphic LCD only:

- Width / Height: Number of pixels.
- Grayscale: Allow pixel values from 0 to 255 instead of on/off.

# Messages

A message is applied in this order:
settings (`msg.backlight`, `msg.contrast`, `msg.bright`, `msg.dim`, `msg.colors`), `msg.fonts`, clear, drawing properties, commands in `msg.payload`, `msg.commands`.

## Settings (both nodes)

| Property | Type | Description |
| --- | --- | --- |
| `msg.clear` | boolean | Clear the display before drawing. |
| `msg.backlight` | boolean \| `"toggle"` | Turn the backlight on or off, or toggle it. |
| `msg.contrast` | number | Contrast, 0 to 1. |
| `msg.bright` | number | Brightness with the backlight on, 0 to 1. |
| `msg.dim` | number | Brightness with the backlight off, 0 to 1. |
| `msg.colors` | object | Any of `off` (backlight), `on` (pixels), `block` (unlit pixels at full contrast) CSS colors. `block: null` goes back to the default. |
| `msg.fonts` | array | Redefine characters: `[{ "code": 0, "data": [0, 10, 31, 31, 14, 4, 0, 0] }]`. `data` is up to 10 rows of 5 pixels. Characters already on the display are not redrawn. |

Messages with only settings never auto clear the display.

## Commands (both nodes)

`msg.payload` can be an array of commands (or one command object), and `msg.commands` another array run after it.
A command is an object with a `cmd` name and its parameters, by name or in order in `args`:

```javascript
{ "cmd": "line", "x0": 0, "y0": 0, "x1": 127, "y1": 63 }
// is the same as
{ "cmd": "line", "args": [0, 0, 127, 63] }
```

Commands for both nodes:

| Command | Parameters | Description |
| --- | --- | --- |
| `clear` | | Clear the display. |
| `font` | `code`, `data` | Define the pixels of a character. |
| `backlight` | `on` | `true`, `false` or `"toggle"`. |
| `contrast` | `value` | 0 to 1. |
| `bright` | `value` | 0 to 1. |
| `dim` | `value` | 0 to 1. |
| `colors` | `off`, `on`, `block` | Change the colors. |

## Character LCD (ui-lcd)

| Property | Type | Description |
| --- | --- | --- |
| `msg.payload` / `msg.text` | string \| number | Printed at `msg.row`, `msg.col` (default 0). `msg.text` is used instead of `msg.payload` when set. `\n` starts a new row. |
| `msg.texts` | array | Several texts, used instead of `msg.text` / `msg.payload`: `[{ "row": 0, "col": 0, "text": "Hello" }]` |
| `msg.chars` | array | Characters by code: `[{ "row": 0, "col": 15, "code": 0 }]` |
| `msg.cusChars` | array | 5x8 pixels of character cells, see [Custom Characters](#custom-characters). |

| Command | Parameters | Description |
| --- | --- | --- |
| `text` | `row`, `col`, `text` | Print text. Unicode characters are mapped to the ROM font. |
| `char` | `row`, `col`, `code` | Show the character with this code, or the first character of a string. |
| `set` | `row`, `col`, `data` | Set the 5x8 pixels of one character cell. |

```javascript
msg.fonts = [{ code: 0, data: [0, 10, 31, 31, 14, 4, 0, 0] }]; // heart
msg.texts = [
    { row: 0, col: 0, text: "Hello LCD!" },
    { row: 1, col: 0, text: "ЁЛКИ-ПАЛКИ!" }
];
msg.chars = [{ row: 0, col: 15, code: 0 }];
msg.contrast = 0.6;
return msg;
```

## Graphic LCD (ui-glcd)

| Property | Type | Description |
| --- | --- | --- |
| `msg.payload` / `msg.text` | string \| number | Printed with the ROM font at `msg.x`, `msg.y` (default 0). |

`x, y` start from `0, 0` at the top left corner; anything outside the display is clipped.
The value `v` is optional, it turns the pixels fully on by default. Normal mode: 0 is off, anything else is on. Grayscale mode: from 0 (off) to 255 (fully on).

| Command | Parameters | Description |
| --- | --- | --- |
| `pixel` | `x`, `y`, `v` | Set one pixel. |
| `fill` | `v` | Set all pixels. |
| `line` | `x0`, `y0`, `x1`, `y1`, `v` | Draw a line. |
| `rect` | `x`, `y`, `w`, `h`, `v` | Draw a rectangle outline. |
| `fillRect` | `x`, `y`, `w`, `h`, `v` | Draw a filled rectangle. |
| `circle` | `x`, `y`, `r`, `v` | Draw a circle outline with the center at `x, y` and radius `r`. |
| `fillCircle` | `x`, `y`, `r`, `v` | Draw a filled circle. |
| `text` | `x`, `y`, `text`, `v`, `bg` | Print text with the ROM font, 6x9 pixels per character, `\n` starts a new line. If `bg` is given the character cells are filled with it first. |
| `bitmap` | `x`, `y`, `w`, `h`, `data` | Draw a `w` x `h` image from `w * h` values, row by row. `data` can also be an array of rows, then `w` and `h` are optional. `null` values are skipped. |

```javascript
msg.payload = [
    { cmd: "rect", x: 0, y: 0, w: 128, h: 64 },
    { cmd: "text", x: 4, y: 4, text: "Hello LCD!" },
    { cmd: "line", args: [4, 60, 60, 16] },
    { cmd: "fillCircle", x: 100, y: 40, r: 10 }
];
return msg;
```

Turn off **Auto Clear** to draw step by step, one message at a time.

## Dashboards opened later

Node-RED keeps the messages since the display was last cleared (by `msg.clear`, Auto Clear, a `clear` command, or a `fill` command on the Graphic LCD), up to 1000 of them, together with the settings from the older ones.
A dashboard opened later replays them, so it shows the same picture.

# Custom Characters

This Node allows you to send custom characters to an LCD display in Node-RED. You can easily create custom characters using the [LCD Character Creator](https://maxpromer.github.io/LCD-Character-Creator/) tool and send them to your display.

1. Create a Custom Character:
   * Go to the [LCD Character Creator](https://maxpromer.github.io/LCD-Character-Creator/).
   * Design your custom character.
   * Set the "Data Type" option to "Hex."
   * Copy the generated hex values for the custom character.

2. Format the Custom Character Payload:
   After generating the hex values, you need to format the data into a payload before sending it to the LCD display. To send multiple custom characters, use an array of objects for `msg.cusChars`.

   ```javascript
   msg.cusChars = [
      {
         "char": [0x1F, 0x1F, 0x1F, 0x1F, 0x1F, 0x1F, 0x1F, 0x1F],
         "row": 0,
         "col": 0
      },
      {
         "char": [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x00, 0x00],
         "row": 0,
         "col": 1
      }
   ];

   return msg;
   ```

   * The `msg.cusChars` property should contain an array of character objects.
   * Each object must contain the `char` data (the hex values), and optionally the `row` and `col` to specify the character's position.
3. Send the Payload:
   Once the payload is formatted, send it to your LCD display using the appropriate function or node to update the display with your custom characters.

To use a custom character inside texts, define it with `msg.fonts` and print its character code.

![image](https://github.com/user-attachments/assets/9835aa98-5c27-441c-b292-7ece42c76291)

# Examples

Import **LCDFeatures** from the Node-RED import menu (Examples) to try every feature of both nodes.

# License

This project is licensed under the **Apache-2.0**. See the [LICENSE](LICENSE).

[`char-lcd`](https://github.com/jazz-soft/char-lcd) is licensed under the **MIT license**.
