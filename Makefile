# This Makefile follows the advice in: https://tech.davis-hansson.com/p/make/

SHELL := bash
.ONESHELL:
# .SHELLFLAGS := -eu -o pipefail -O inherit_errexit -c
.DELETE_ON_ERROR:
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules

ifeq ($(origin .RECIPEPREFIX), undefined)
> $(error This Make does not support .RECIPEPREFIX. Please use GNU Make 4.0 or later)
endif
.RECIPEPREFIX = >

LICENSE_HEADER = // Copyright 2022 issue_13142_text_decoder_stream contributors. All rights reserved. MIT license.

help:
> echo "Available targets:"
> printf '  %s\n' $$(grep -P --only-matching '^[\w-]+(?=:)' Makefile)
.PHONY: help
.SILENT: help

.out:
> mkdir -p .out

clean:
> rm -rf .out
.PHONY: clean

lint: ensure-licensed
> deno lint
.PHONY: lint

check-format:
> deno fmt --check
.PHONY: check-format

apply-format:
> deno fmt
.PHONY: auto-format-files

test:
> deno test --allow-read=test_data --allow-run=deno
.PHONY: test

ensure-licensed:
# https://deno.land/manual/contributing/style_guide#copyright-headers
> UNLICENSED="$$(\
  find . -name '*.ts' -not -path './examples/*' -exec \
    grep -FL '$(LICENSE_HEADER)' {} + \
    || test $$? -eq 1 \
  )"
> if [[ $$UNLICENSED != "" ]]; then
>   echo -e "Error: Not all modules contain the copyright header:\n$$UNLICENSED" 2>&1
>   exit 1
> fi
.PHONY: ensure-licensed
.SILENT: ensure-licensed
