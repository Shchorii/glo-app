import assert from "node:assert/strict";
import test from "node:test";
import {
  bookParamsEqual,
  parseBookParams,
  readBookParams,
  serializeBookParams,
} from "../src/lib/book-params.ts";

test("parseBookParams reads the shared list URL", () => {
  assert.deepEqual(parseBookParams("?city=Chicago&venue=bar&view=list"), {
    city: "Chicago",
    venue: "bar",
    query: "",
    view: "list",
  });
});

test("parseBookParams treats a missing view as map and ignores blanks", () => {
  assert.deepEqual(parseBookParams("?city=&venue=bar&view=map&q=11249"), {
    city: null,
    venue: "bar",
    query: "11249",
    view: "map",
  });
  assert.deepEqual(parseBookParams(""), {
    city: null,
    venue: null,
    query: "",
    view: "map",
  });
});

test("serializeBookParams keeps view only for list and preserves other keys", () => {
  const list = serializeBookParams("?utm=fall", {
    city: "San Francisco",
    venue: "bar",
    query: " 94110 ",
    view: "list",
  });
  const parsed = parseBookParams(list);
  assert.deepEqual(parsed, {
    city: "San Francisco",
    venue: "bar",
    query: "94110",
    view: "list",
  });
  assert.match(list, /(^|&)utm=fall(&|$)/);
  assert.match(list, /(^|&)view=list(&|$)/);

  const map = serializeBookParams("?city=Chicago&venue=bar&view=list", {
    city: "Chicago",
    venue: "bar",
    query: "",
    view: "map",
  });
  assert.equal(parseBookParams(map).view, "map");
  assert.doesNotMatch(map, /view=/);
  assert.match(map, /city=Chicago/);
  assert.match(map, /venue=bar/);
});

test("bookParamsEqual ignores surrounding whitespace on the search query", () => {
  assert.equal(bookParamsEqual(
    { city: "Chicago", venue: "bar", query: "11249", view: "list" },
    { city: "Chicago", venue: "bar", query: " 11249 ", view: "list" },
  ), true);
  assert.equal(bookParamsEqual(
    { city: "Chicago", venue: null, query: "", view: "list" },
    { city: "Chicago", venue: null, query: "", view: "map" },
  ), false);
});

test("readBookParams is empty during prerender", () => {
  assert.deepEqual(readBookParams(), {
    city: null,
    venue: null,
    query: "",
    view: "map",
  });
});
