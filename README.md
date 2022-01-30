# `issue_13142_text_decoder_stream`

![CI status](https://github.com/h4l/issue_13142_text_decoder_stream/actions/workflows/ci.yml/badge.svg?branch=main)
[![deno.land](https://img.shields.io/badge/available%20on-deno.land/x-lightgrey.svg?logo=deno&labelColor=black)](https://deno.land/x/issue_13142_text_decoder_stream@1.0.0/)
[![API Docs](https://doc.deno.land/badge.svg)](https://doc.deno.land/https://deno.land/x/issue_13142_text_decoder_stream@1.0.0/mod.ts)

This [Deno] module provides `Issue13142TextDecoderStream`, a workaround for
[denoland/deno#13142] (the `TextDecoderStream` leaks a native resource handle if
it aborts instead of closing normally).

[denoland/deno#13142]: https://github.com/denoland/deno/issues/13142
[Deno]: https://deno.land/

## Usage

```ts
import {
  Issue13142TextDecoderStream,
} from "https://deno.land/x/issue_13142_text_decoder_stream@1.0.0/mod.ts";
```

Use `Issue13142TextDecoderStream` just like `TextDecoderStream`. See
[./mod_test.ts](./mod_test.ts) for examples.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to
discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)
