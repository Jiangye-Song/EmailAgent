export interface Env {
  CF_INBOUND_SECRET: string;
  INBOUND_URL: string; // e.g. https://your-fc-domain.com/api/inbound
}

const emailWorker = {
  async email(
    message: {
      to: string;
      from: string;
      raw: ReadableStream<Uint8Array>;
    },
    env: Env,
  ): Promise<void> {
    const body = await new Response(message.raw).arrayBuffer();

    const res = await fetch(env.INBOUND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "message/rfc822",
        "X-CF-Secret": env.CF_INBOUND_SECRET,
        "X-Recipient": message.to,
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`Inbound API returned ${res.status}`);
    }
  },
};

export default emailWorker;
