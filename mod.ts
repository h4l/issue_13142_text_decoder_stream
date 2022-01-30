// Copyright 2022 issue_13142_text_decoder_stream contributors. All rights reserved. MIT license.
import { ShutdownAwareTransformStream } from "https://deno.land/x/shutdown_aware_transform_stream@1.0.0/mod.ts";

/** Identical to [`TextDecoderStream`], but without the [denoland/deno#13142] bug.
 *
 * [`TextDecoderStream`]: https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream
 * [denoland/deno#13142]: https://github.com/denoland/deno/issues/13142
 */
export class Issue13142TextDecoderStream implements TextDecoderStream {
  #decoder: TextDecoder;
  #transform: TransformStream<BufferSource, string>;

  constructor(label: string = "utf-8", options: TextDecoderOptions = {}) {
    this.#decoder = new TextDecoder(label, options);
    this.#transform = new ShutdownAwareTransformStream({
      transformer: {
        transform: (chunk, controller) => {
          const decoded = this.#decoder.decode(chunk, { stream: true });
          if (decoded) controller.enqueue(decoded);
        },
        flush: (controller) => {
          const decoded = this.#decoder.decode();
          if (decoded) controller.enqueue(decoded);
        },
        close: () => {
          // a non-streaming decode() call closes resources held by the decoder
          this.#decoder.decode();
        },
      },
    });
  }
  get readable() {
    return this.#transform.readable;
  }
  get writable() {
    return this.#transform.writable;
  }
  get encoding() {
    return this.#decoder.encoding;
  }
  get fatal() {
    return this.#decoder.fatal;
  }
  get ignoreBOM() {
    return this.#decoder.ignoreBOM;
  }
  get [Symbol.toStringTag]() {
    return Issue13142TextDecoderStream.name;
  }
}
