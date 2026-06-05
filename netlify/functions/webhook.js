exports.handler = async (event) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Webhook verification
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters || {};

    if (
      params["hub.mode"] === "subscribe" &&
      params["hub.verify_token"] === VERIFY_TOKEN
    ) {
      return {
        statusCode: 200,
        body: params["hub.challenge"],
      };
    }

    return {
      statusCode: 403,
      body: "Forbidden",
    };
  }

  // Incoming messages
  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body);

      const messages =
        body?.entry?.[0]?.changes?.[0]?.value?.messages;

      if (messages && messages.length > 0) {
        const sender = messages[0].from;

        await fetch(
          `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: sender,
              type: "text",
              text: {
                body: "OK."
              }
            }),
          }
        );
      }

      return {
        statusCode: 200,
        body: "EVENT_RECEIVED",
      };
    } catch (err) {
      console.error(err);

      return {
        statusCode: 500,
        body: "Internal Server Error",
      };
    }
  }

  return {
    statusCode: 405,
    body: "Method Not Allowed",
  };
};