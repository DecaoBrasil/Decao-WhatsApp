exports.handler = async (event) => {
  console.log("=== WEBHOOK INVOKED ===");
  console.log("Method:", event.httpMethod);
  console.log("Headers:", JSON.stringify(event.headers, null, 2));
  console.log("Query params:", JSON.stringify(event.queryStringParameters, null, 2));
  console.log("Raw body:", event.body);

  // --- Env vars ---
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  console.log("Env check — VERIFY_TOKEN present:", !!VERIFY_TOKEN);
  console.log("Env check — ACCESS_TOKEN present:", !!ACCESS_TOKEN);
  console.log("Env check — PHONE_NUMBER_ID present:", !!PHONE_NUMBER_ID);
  console.log("Env check — PHONE_NUMBER_ID value:", PHONE_NUMBER_ID);

  // --- GET: Verification ---
  if (event.httpMethod === "GET") {
    console.log("=== VERIFICATION REQUEST ===");
    const params = event.queryStringParameters || {};
    console.log("hub.mode:", params["hub.mode"]);
    console.log("hub.verify_token:", params["hub.verify_token"]);
    console.log("hub.challenge:", params["hub.challenge"]);
    console.log("Token match:", params["hub.verify_token"] === VERIFY_TOKEN);

    if (
      params["hub.mode"] === "subscribe" &&
      params["hub.verify_token"] === VERIFY_TOKEN
    ) {
      console.log("Verification PASSED — returning challenge");
      return { statusCode: 200, body: params["hub.challenge"] };
    }

    console.log("Verification FAILED — returning 403");
    return { statusCode: 403, body: "Forbidden" };
  }

  // --- POST: Incoming message ---
  if (event.httpMethod === "POST") {
    console.log("=== INCOMING POST ===");

    // Parse body
    let body;
    try {
      body = JSON.parse(event.body);
      console.log("Parsed body:", JSON.stringify(body, null, 2));
    } catch (parseErr) {
      console.log("ERROR: Failed to parse body:", parseErr.message);
      return { statusCode: 200, body: "EVENT_RECEIVED" };
    }

    // Dig into payload
    const entry = body?.entry?.[0];
    console.log("entry[0]:", JSON.stringify(entry, null, 2));

    const change = entry?.changes?.[0];
    console.log("changes[0]:", JSON.stringify(change, null, 2));

    const value = change?.value;
    console.log("value:", JSON.stringify(value, null, 2));

    const messages = value?.messages;
    console.log("messages:", JSON.stringify(messages, null, 2));

    // Status updates (no messages key) — log and bail early
    if (!messages || messages.length === 0) {
      console.log("No messages found — likely a status update, ignoring");
      return { statusCode: 200, body: "EVENT_RECEIVED" };
    }

    const msg = messages[0];
    const sender = msg.from;
    const msgType = msg.type;
    const msgText = msg?.text?.body;

    console.log("Sender:", sender);
    console.log("Message type:", msgType);
    console.log("Message text:", msgText);

    // Build reply payload
    const replyPayload = {
      messaging_product: "whatsapp",
      to: sender,
      type: "text",
      text: { body: "OK." },
    };
    console.log("Reply payload:", JSON.stringify(replyPayload, null, 2));

    // Send reply
    const url = `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`;
    console.log("Sending to URL:", url);

    let fetchRes;
    try {
      fetchRes = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(replyPayload),
      });
    } catch (fetchErr) {
      console.log("ERROR: fetch() threw an exception:", fetchErr.message);
      console.log("Full fetch error:", fetchErr);
      return { statusCode: 200, body: "EVENT_RECEIVED" };
    }

    console.log("Graph API HTTP status:", fetchRes.status, fetchRes.statusText);

    let fetchBody;
    try {
      fetchBody = await fetchRes.json();
      console.log("Graph API response body:", JSON.stringify(fetchBody, null, 2));
    } catch (jsonErr) {
      console.log("ERROR: Could not parse Graph API response as JSON:", jsonErr.message);
    }

    if (!fetchRes.ok) {
      console.log("ERROR: Graph API returned non-2xx status");
    } else {
      console.log("SUCCESS: Message sent");
    }

    return { statusCode: 200, body: "EVENT_RECEIVED" };
  }

  // --- Fallback ---
  console.log("Unhandled HTTP method:", event.httpMethod);
  return { statusCode: 405, body: "Method Not Allowed" };
};