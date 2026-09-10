import test from "node:test";
import assert from "node:assert/strict";

import { can, type Action } from "./permissions";

test("admin permission checks are case-insensitive and trimmed", () => {
  assert.equal(can("ADMIN", "project:create"), true);
  assert.equal(can(" admin ", "project:create"), true);
  assert.equal(can("Producer", "asset:download"), true);
  assert.equal(can("Developer", "task:update"), true);
});

const MATRIX: Record<string, Partial<Record<Action, boolean>>> = {
  producer: {
    "project:create": true,
    "project:manage": true,
    "sprint:manage": true,
    "sprint:update": true,
    "task:manage": true,
    "task:update": true,
    "asset:upload": false,
    "asset:delete": false,
    "asset:download": true,
    "bug:manage": true,
    "bug:view": true,
    "team:invite": false,
    "settings:system": false,
    "settings:account": true,
  },
  developer: {
    "project:create": false,
    "project:manage": false,
    "sprint:manage": false,
    "sprint:update": true,
    "task:manage": false,
    "task:update": true,
    "asset:upload": false,
    "asset:delete": false,
    "asset:download": true,
    "bug:manage": true,
    "bug:view": true,
    "team:invite": false,
    "settings:system": false,
    "settings:account": true,
  },
  designer: {
    "project:create": false,
    "project:manage": false,
    "sprint:manage": false,
    "sprint:update": true,
    "task:manage": false,
    "task:update": true,
    "asset:upload": true,
    "asset:delete": true,
    "asset:download": true,
    "bug:manage": false,
    "bug:view": true,
    "team:invite": false,
    "settings:system": false,
    "settings:account": true,
  },
  qa: {
    "project:create": false,
    "project:manage": false,
    "sprint:manage": false,
    "sprint:update": true,
    "task:manage": false,
    "task:update": true,
    "asset:upload": false,
    "asset:delete": false,
    "asset:download": true,
    "bug:manage": true,
    "bug:view": true,
    "team:invite": false,
    "settings:system": false,
    "settings:account": true,
  },
};

test("non-admin roles match GSMS permission matrix", () => {
  for (const [role, actions] of Object.entries(MATRIX)) {
    for (const [action, expected] of Object.entries(actions)) {
      assert.equal(can(role, action as Action), expected, `${role} ${action}`);
    }
  }
});
