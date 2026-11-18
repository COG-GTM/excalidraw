import { roundRect } from "./roundRect";

const createContext = () =>
  ({
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: "#000",
  } as unknown as CanvasRenderingContext2D & {
    [K in keyof CanvasRenderingContext2D]: any;
  });

describe("roundRect", () => {
  it("draws a closed rounded rectangle path", () => {
    const context = createContext();
    roundRect(context, 10, 20, 100, 50, 5);

    expect(context.beginPath).toHaveBeenCalledTimes(1);
    expect(context.moveTo).toHaveBeenCalledWith(15, 20);
    expect((context.lineTo as any).mock.calls).toEqual([
      [105, 20],
      [110, 65],
      [15, 70],
      [10, 25],
    ]);
    expect((context.quadraticCurveTo as any).mock.calls).toEqual([
      [110, 20, 110, 25],
      [110, 70, 105, 70],
      [10, 70, 10, 65],
      [10, 20, 15, 20],
    ]);
    expect(context.closePath).toHaveBeenCalledTimes(1);
    expect(context.fill).toHaveBeenCalledTimes(1);
    expect(context.stroke).toHaveBeenCalledTimes(1);
    expect(context.strokeStyle).toBe("#000");
  });

  it("applies the stroke color when provided", () => {
    const context = createContext();
    roundRect(context, 0, 0, 10, 10, 2, "#ff0000");
    expect(context.strokeStyle).toBe("#ff0000");
    expect(context.stroke).toHaveBeenCalledTimes(1);
  });
});
