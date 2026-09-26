// Shared Africa's Talking SMS sender, used both for admin alerts (monitor.js) and farmer-facing
// replies (index.js's AI advice flow). Never throws: a missing secret or a failed send must not
// crash whatever background task is trying to deliver a message.
export async function sendSms(env, to, message) {
  if (!env.AT_USERNAME || !env.AT_API_KEY) {
    console.error("AT_USERNAME/AT_API_KEY not set; skipping SMS send", { to });
    return false;
  }

  const safeText = message.slice(0, 280);
  const params = new URLSearchParams({ username: env.AT_USERNAME, to, message: safeText, from: "TONA" });

  try {
    const res = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        apiKey: env.AT_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });
    if (!res.ok) console.error("SMS send failed", { to, status: res.status });
    return res.ok;
  } catch (e) {
    console.error("SMS send failed", { to, error: String(e) });
    return false;
  }
}
