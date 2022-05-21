import { strict as assert } from "assert"

import { mdFileName } from "./tikibase-provider"

suite("mdFileName", function() {
  test("normal", function() {
    const give = "one two"
    const want = "one-two.md"
    const have = mdFileName(give)
    assert.equal(have, want)
  })
})
