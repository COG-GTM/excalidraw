import {
  AbortError,
  CanvasError,
  ExcalidrawError,
  ImageSceneDataError,
  RequestError,
  WorkerInTheMainChunkError,
  WorkerUrlNotDefinedError,
} from "./errors";

describe("errors", () => {
  it("CanvasError", () => {
    const error = new CanvasError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("CANVAS_ERROR");
    expect(error.message).toBe("Couldn't export canvas.");

    const tooBig = new CanvasError("too big", "CANVAS_POSSIBLY_TOO_BIG");
    expect(tooBig.name).toBe("CANVAS_POSSIBLY_TOO_BIG");
    expect(tooBig.message).toBe("too big");
  });

  it("AbortError", () => {
    expect(new AbortError()).toMatchObject({
      name: "AbortError",
      message: "Request Aborted",
    });
    expect(new AbortError("stop").message).toBe("stop");
  });

  it("ImageSceneDataError", () => {
    expect(new ImageSceneDataError()).toMatchObject({
      name: "EncodingError",
      message: "Image Scene Data Error",
      code: "IMAGE_SCENE_DATA_ERROR",
    });
    expect(
      new ImageSceneDataError("none", "IMAGE_NOT_CONTAINS_SCENE_DATA").code,
    ).toBe("IMAGE_NOT_CONTAINS_SCENE_DATA");
  });

  it("worker errors", () => {
    expect(new WorkerUrlNotDefinedError()).toMatchObject({
      name: "WorkerUrlNotDefinedError",
      message: "Worker URL is not defined!",
      code: "WORKER_URL_NOT_DEFINED",
    });
    expect(new WorkerInTheMainChunkError()).toMatchObject({
      name: "WorkerInTheMainChunkError",
      message: "Worker has to be in a separate chunk!",
      code: "WORKER_IN_THE_MAIN_CHUNK",
    });
  });

  it("ExcalidrawError", () => {
    const error = new ExcalidrawError("handled");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ExcalidrawError");
    expect(error.message).toBe("handled");
  });

  it("RequestError", () => {
    const error = new RequestError();
    expect(error.toObject()).toEqual({
      name: "RequestError",
      status: 500,
      message: "Something went wrong",
    });
    expect(error.data).toBeUndefined();

    const custom = new RequestError({
      message: "Not found",
      status: 404,
      data: { id: 1 },
    });
    expect(custom.toObject()).toEqual({
      name: "RequestError",
      status: 404,
      message: "Not found",
    });
    expect(custom.data).toEqual({ id: 1 });
  });
});
