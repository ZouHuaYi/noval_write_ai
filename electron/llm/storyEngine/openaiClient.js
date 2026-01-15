const DEFAULT_TIMEOUT = 600000

class OpenAIClient {
  constructor({
    apiKey,
    baseUrl,
    model,
    timeout = DEFAULT_TIMEOUT
  } = {}) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.model = model
    this.timeout = timeout
  }

  async chat({
    system,
    user,
    temperature = 0,
    max_tokens = 2048
  }) {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      timeout: this.timeout,
      body: JSON.stringify({
        model: this.model,
        temperature,
        max_tokens,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: user }
        ]
      })
    })


    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`LLM API Error: ${res.status}\n${errText}`)
    }

    const data = await res.json()
    return data.choices[0].message.content
  }
}

module.exports = { OpenAIClient }
