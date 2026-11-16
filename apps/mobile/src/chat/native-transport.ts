import { AssistantChatTransport, RESUMABLE_STREAM_ID_HEADER, type AssistantChatResumableOptions } from "@assistant-ui/ai-sdk";
import type { UIMessage } from "ai";

type LibraryTransportOptions = NonNullable<ConstructorParameters<typeof AssistantChatTransport<UIMessage>>[0]>;

export interface NativeChatTransportOptions
  extends Omit<LibraryTransportOptions, "resumable" | "fetch" | "prepareReconnectToStreamRequest"> {
  fetch: typeof fetch;
  resumable: AssistantChatResumableOptions;
}

/**
 * AssistantChatTransport for the React Native app, with the same resume behaviour as the web app.
 *
 * The library's `resumable` option wraps each response with `new Response(stream)`. React Native's Response
 * (whatwg-fetch) cannot hold a stream: the body becomes the text "[object ReadableStream]" and `response.body` is
 * undefined. The reply then never arrives, and the message just stays sent. So this transport does not use that
 * option. It keeps the resumable bookkeeping itself and leaves each response as fetch returned it:
 *  - a sent turn's stream id is kept from its response header;
 *  - a reconnect reads /api/chat/resume/<streamId>; a 204 or 404 means the turn is over or forgotten, so the id is dropped;
 *  - the id is dropped when the turn finishes (see useArtemisRuntime, onFinish).
 */
export class NativeChatTransport extends AssistantChatTransport<UIMessage> {
  private readonly nativeOptions: NativeChatTransportOptions;
  private readonly nativeResumable: AssistantChatResumableOptions;

  constructor(options: NativeChatTransportOptions) {
    const { resumable, fetch: userFetch, ...rest } = options;
    super({
      ...rest,
      fetch: trackResumableStream(resumable, userFetch),
      prepareReconnectToStreamRequest: () => {
        const streamId = resumable.storage.getStreamId();
        if (!streamId) throw new Error("no resumable stream id available; nothing to resume");
        const api = typeof resumable.resumeApi === "function" ? resumable.resumeApi(streamId) : resumable.resumeApi;
        return { api };
      },
    });
    this.nativeOptions = options;
    this.nativeResumable = resumable;
  }

  /** The runtime reads this to resume a running turn when the conversation opens. */
  override getResumableAdapter(): AssistantChatResumableOptions {
    return this.nativeResumable;
  }

  /** The library clones transports to build per-thread copies; the clone keeps this transport's storage. */
  override __internal_clone(): NativeChatTransport {
    return new NativeChatTransport(this.nativeOptions);
  }
}

/** Records the stream id of a sent turn, and forgets it when a reconnect finds no turn. The response is not touched. */
function trackResumableStream(resumable: AssistantChatResumableOptions, userFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const response = await userFetch(input, init);
    if ((init?.method ?? "GET").toUpperCase() === "GET") {
      if (response.status === 204 || response.status === 404) resumable.storage.clear();
      return response;
    }
    const streamId = response.headers.get(RESUMABLE_STREAM_ID_HEADER);
    if (streamId) resumable.storage.setStreamId(streamId);
    return response;
  };
}
