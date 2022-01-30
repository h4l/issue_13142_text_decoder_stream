// Copyright 2022 issue_13142_text_decoder_stream contributors. All rights reserved. MIT license.
import {
  assert,
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.123.0/testing/asserts.ts";
import { Issue13142TextDecoderStream } from "./mod.ts";
import {
  chunks,
  escapeRegExp,
  RecorderWritableStream,
  runProcessWithPermissionRequest,
  transformCaseFromFile,
  transformCaseFromStringChunks,
  TransformTestCaseData,
} from "./_test_utils.ts";

const testDir = new URL("./test_data/", import.meta.url);
const unicodeSample32 = new URL("./unicode-sample-3-2.html", testDir);
const utf8StressTest = new URL("./UTF-8-test.txt", testDir);
await Deno.permissions.request({ name: "read", path: testDir });

const runXFailTests =
  (await Deno.permissions.query({ name: "env", variable: "RUN_XFAIL_TESTS" }))
      .state === "granted" && Deno.env.get("RUN_XFAIL_TESTS") === "true";

Deno.test("options: defaults", () => {
  const actual = new Issue13142TextDecoderStream();
  const expected = new TextDecoderStream();
  assertStrictEquals(actual.encoding, expected.encoding);
  assertStrictEquals(actual.encoding, "utf-8");
  assertStrictEquals(actual.fatal, expected.fatal);
  assertStrictEquals(actual.fatal, false);
  assertStrictEquals(actual.ignoreBOM, expected.ignoreBOM);
  assertStrictEquals(actual.ignoreBOM, false);
});

Deno.test("options: label", () => {
  const actual = new Issue13142TextDecoderStream("utf-16");
  const expected = new TextDecoderStream("utf-16");
  assertStrictEquals(actual.encoding, expected.encoding);
  assertStrictEquals(actual.encoding, "utf-16le");
});

Deno.test("options: fatal", () => {
  const actual = new Issue13142TextDecoderStream(undefined, { fatal: true });
  const expected = new TextDecoderStream(undefined, { fatal: true });
  assertStrictEquals(actual.fatal, expected.fatal);
  assertStrictEquals(actual.fatal, true);
});

Deno.test("options: ignoreBOM", () => {
  const actual = new Issue13142TextDecoderStream(undefined, {
    ignoreBOM: true,
  });
  const expected = new TextDecoderStream(undefined, { ignoreBOM: true });
  assertStrictEquals(actual.ignoreBOM, expected.ignoreBOM);
  assertStrictEquals(actual.ignoreBOM, true);
});

type TransformTestCase = TransformTestCaseData & { name: string };

const transformCases: ReadonlyArray<TransformTestCase> = [
  { name: "zero chunks", ...transformCaseFromStringChunks([]) },
  { name: "empty chunk", ...transformCaseFromStringChunks([""]) },
  { name: "single chunk", ...transformCaseFromStringChunks(["foo"]) },
  {
    name: "empty and non-empty chunks a",
    ...transformCaseFromStringChunks(["foo", ""]),
  },
  {
    name: "empty and non-empty chunks b",
    ...transformCaseFromStringChunks(["", "foo", "", "bar"]),
  },
  {
    name: "unicode-sample-3-2.html",
    ...transformCaseFromFile({
      inputFilePath: unicodeSample32,
      inputFileEncoding: "utf-8",
      outputUtf8FilePath: unicodeSample32,
    }),
  },
  {
    name: "UTF-8-test.txt",
    ...transformCaseFromFile({
      inputFilePath: utf8StressTest,
      inputFileEncoding: "utf-8",
      outputUtf8FilePath: utf8StressTest,
    }),
  },
];

for (const c of transformCases) {
  Deno.test(`decode stream: ${c.name}`, async () => {
    const actualTx = new Issue13142TextDecoderStream(c.encoding);
    const expectedTx = new TextDecoderStream(c.encoding);

    const actualRecorder = new RecorderWritableStream();
    const expectedRecorder = new RecorderWritableStream();

    await (await c.input()).pipeThrough(actualTx).pipeTo(actualRecorder);
    await (await c.input()).pipeThrough(expectedTx).pipeTo(expectedRecorder);

    assertEquals(actualRecorder.events, expectedRecorder.events);

    const expectedOutput = await c.expected();
    assertStrictEquals(chunks(actualRecorder.events).join(""), expectedOutput);
    assertStrictEquals(
      chunks(expectedRecorder.events).join(""),
      expectedOutput,
    );
  });
}

type Issue13142TriggerCases = {
  textDecoderStreamConstructor: typeof TextDecoderStream;
  willTriggerIssue13142: boolean;
};

const issue13142Cases: ReadonlyArray<Issue13142TriggerCases> = [
  {
    textDecoderStreamConstructor: Issue13142TextDecoderStream,
    willTriggerIssue13142: false,
  },
  {
    textDecoderStreamConstructor: TextDecoderStream,
    willTriggerIssue13142: true,
  },
];

// These tests trigger https://github.com/denoland/deno/issues/13142
// TextDecoderStream fails to clean up a native resource handle when it's
// aborted, as it relies on flush() being called to clean up its text decoder
// resource.
//
// The Deno test runner detects a leaked resource and aborts the test suite.
// To test this, xfail (expected to fail) test is not run in the normal suite,
// instead a proxy test is used to run the xfail test in a subprocess and assert
// that the xfail test has failed in the expected way.
for (const c of issue13142Cases) {
  const typeName = c.textDecoderStreamConstructor.name;
  const expectedToFail = c.willTriggerIssue13142;
  const xfailTag = expectedToFail ? " [xfail]" : "";
  const name =
    `decoding invalid UTF-8 stream fails with {fatal: true} [type=${typeName}]${xfailTag}`;

  Deno.test({
    name,
    ignore: expectedToFail && !runXFailTests,
    fn: async () => {
      const tx = new c.textDecoderStreamConstructor(undefined, { fatal: true });
      const recorder = new RecorderWritableStream();

      // This is invalid UTF-8 data, which will cause an error when fatal is on
      const testData = transformCaseFromFile({
        inputFilePath: utf8StressTest,
        inputFileEncoding: "utf-8",
        outputUtf8FilePath: utf8StressTest,
      });

      await assertRejects(
        async () => (await testData.input()).pipeThrough(tx).pipeTo(recorder),
        TypeError,
        "The encoded data is not valid.",
      );
      const abort = recorder.events.at(-1);
      assert(abort?.type === "abort");
      assert(abort?.reason instanceof TypeError);
      assertStrictEquals(
        abort?.reason.message,
        "The encoded data is not valid.",
      );
    },
  });

  // Make a test that runs the failing test in a subprocess. We can't run it
  // directly as the test runner aborts when this fails.
  if (expectedToFail) {
    Deno.test(`must fail: ${name}`, async () => {
      const thisFile = import.meta.url.toString();
      const namePattern = `/^${escapeRegExp(name)}$/`;
      const cmd = [
        "deno",
        "test",
        `--allow-read=${testDir.pathname}`,
        "--allow-env=RUN_XFAIL_TESTS",
        "--filter",
        namePattern,
        "--",
        thisFile,
      ];
      const { output, status } = await (async () => {
        let proc: Deno.Process | undefined = undefined;
        try {
          proc = await runProcessWithPermissionRequest({
            cmd,
            env: { RUN_XFAIL_TESTS: "true" },
            stdout: "piped",
            stderr: "null",
          });
          const output = new TextDecoder().decode(await proc.output());
          const status = await proc.status();
          return { output, status };
        } finally {
          proc?.close();
        }
      })();

      assertStringIncludes(output, `running 1 test from ${import.meta.url}`);
      assertStringIncludes(output, `test ${name}`);
      assertStringIncludes(
        output,
        "AssertionError: Test case is leaking resources.",
      );
      assertStringIncludes(
        output,
        "Make sure to close all open resource handles returned from Deno APIs",
      );
      assert(!status.success);
    });
  }
}
