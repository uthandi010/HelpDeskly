import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicTicket, replyToTicket } from "../public";

describe("public ticket api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the access token as a header, never in the URL", async () => {
    await getPublicTicket("t1", "secret-token");

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain("secret-token");
    expect(String(url)).not.toContain("?");
    expect((init.headers as Record<string, string>)["X-Ticket-Token"]).toBe("secret-token");
  });

  it("sends the access token as a header when replying", async () => {
    await replyToTicket("t1", "secret-token", "hello");

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain("secret-token");
    expect((init.headers as Record<string, string>)["X-Ticket-Token"]).toBe("secret-token");
  });
});
