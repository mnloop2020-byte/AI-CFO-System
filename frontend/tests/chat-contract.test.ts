import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAT_RESPONSE_VERSION,
  getSafeAssistantContent,
  parseChatResponse,
} from "../lib/chat-contract.ts";

const BASE_RESPONSE = {
  response_version: CHAT_RESPONSE_VERSION,
  conversation_id: "conversation-1",
  sources: [],
};

test("keeps a single-agent Markdown reply", () => {
  const response = parseChatResponse(
    {
      ...BASE_RESPONSE,
      reply: "## Sales summary\n\n- Completed revenue: **200.00**",
    },
    "en",
  );

  assert.match(response.reply, /^## Sales summary/);
  assert.doesNotMatch(response.reply, /"agents"|"results"/u);
});

test("ignores structured multi-agent fields and keeps only final reply", () => {
  const response = parseChatResponse(
    {
      ...BASE_RESPONSE,
      reply: "## Executive summary\n\nThe verified records are summarized below.",
      agents: ["sales", "accounting"],
      results: { sales: { completed_revenue: 200 } },
    },
    "en",
  );

  assert.equal(
    response.reply,
    "## Executive summary\n\nThe verified records are summarized below.",
  );
  assert.doesNotMatch(response.reply, /agents|results/u);
});

test("keeps a readable Arabic Markdown report", () => {
  const response = parseChatResponse(
    {
      ...BASE_RESPONSE,
      reply: "## الملخص المالي\n\n- الإيرادات المكتملة: **200.00**",
    },
    "ar",
  );

  assert.match(response.reply, /^## الملخص المالي/u);
});

test("keeps a readable English Markdown report", () => {
  const response = parseChatResponse(
    {
      ...BASE_RESPONSE,
      reply: "| Metric | Value |\n|---|---:|\n| Revenue | 200.00 |",
    },
    "en",
  );

  assert.match(response.reply, /\| Metric \| Value \|/u);
});

test("uses a safe fallback when final reply is missing", () => {
  const response = parseChatResponse(
    {
      ...BASE_RESPONSE,
      agents: ["sales"],
      results: { private: "internal" },
    },
    "en",
  );

  assert.equal(
    response.reply,
    "The final financial response could not be displayed safely. Please try again.",
  );
  assert.doesNotMatch(response.reply, /private|internal|agents|results/u);
});

test("blocks raw and fenced internal JSON from the interface", () => {
  const rawReply = getSafeAssistantContent(
    '{"agents":["sales"],"results":{"revenue":200}}',
    "en",
  );
  const fencedReply = getSafeAssistantContent(
    "### Verified financial data\n\n```json\n{\"overview\":{\"count\":1}}\n```",
    "en",
  );

  for (const reply of [rawReply, fencedReply]) {
    assert.doesNotMatch(reply, /\{|\}|agents|results|overview|```json/u);
  }
});

test("rejects an incompatible response contract without serializing it", () => {
  assert.throws(
    () =>
      parseChatResponse(
        {
          response_version: "2",
          conversation_id: "conversation-1",
          reply: { results: { private: true } },
        },
        "ar",
      ),
    /استجابة محادثة غير متوافقة/u,
  );
});
