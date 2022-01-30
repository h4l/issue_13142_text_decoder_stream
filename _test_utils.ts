// Copyright 2022 issue_13142_text_decoder_stream contributors. All rights reserved. MIT license.
import {
  readableStreamFromIterable,
  readableStreamFromReader,
} from "https://deno.land/std@0.123.0/streams/conversion.ts";

export type TransformTestCaseData = {
  encoding: string;
  input: () => Promise<ReadableStream<BufferSource>>;
  expected: () => Promise<string>;
};

export function transformCaseFromStringChunks(
  chunks: ReadonlyArray<string>,
): TransformTestCaseData {
  return {
    encoding: "utf-8",
    input() {
      const encodedChunks = function* () {
        const encoder = new TextEncoder();
        for (const chunk of chunks) {
          yield encoder.encode(chunk);
        }
      };
      return Promise.resolve(readableStreamFromIterable(encodedChunks()));
    },
    expected() {
      return Promise.resolve(chunks.join(""));
    },
  };
}

export function transformCaseFromFile(options: {
  inputFilePath: string | URL;
  inputFileEncoding: string;
  outputUtf8FilePath: string | URL;
}): TransformTestCaseData {
  return {
    async input() {
      const f = await Deno.open(options.inputFilePath, { read: true });
      return readableStreamFromReader(f);
    },
    encoding: options.inputFileEncoding,
    async expected() {
      return new TextDecoder().decode(
        await Deno.readFile(options.outputUtf8FilePath),
      );
    },
  };
}

type WritableStreamWriteEvent<T> = { type: "write"; chunk: T };
type WritableStreamEvent<T> =
  | WritableStreamWriteEvent<T>
  | { type: "close" }
  | { type: "abort"; reason: unknown };
export class RecorderWritableStream<T = unknown> extends WritableStream<T> {
  #events: WritableStreamEvent<T>[];
  constructor() {
    super({
      write: (chunk) => {
        this.#events.push({ type: "write", chunk });
      },
      close: () => {
        this.#events.push({ type: "close" });
      },
      abort: (reason) => {
        this.#events.push({ type: "abort", reason });
      },
    });
    this.#events = [];
  }

  get events(): WritableStreamEvent<T>[] {
    return [...this.#events];
  }
}

export function chunks<T>(events: WritableStreamEvent<T>[]): T[] {
  return events
    .filter((e): e is WritableStreamWriteEvent<T> => e.type === "write")
    .map((e) => e.chunk);
}

export async function runProcessWithPermissionRequest<
  RunOptions extends Deno.RunOptions = Deno.RunOptions,
>(options: RunOptions): Promise<Deno.Process<RunOptions>> {
  const requestedCmd = options.cmd[0];
  const status = await Deno.permissions.query({
    name: "run",
    command: requestedCmd,
  });
  if (status.state !== "granted") {
    await Deno.permissions.request({ name: "run", command: requestedCmd });
  }
  return Deno.run(options);
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
