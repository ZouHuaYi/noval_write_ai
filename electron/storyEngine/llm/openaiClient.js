const DEFAULT_MODEL = "gpt-4.1-mini" // 你可以换 deepseek-chat 等

class OpenAIClient {
  constructor({
    apiKey,
    baseUrl = "https://api.openai.com/v1",
    model = DEFAULT_MODEL
  }) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.model = model
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
      timeout: 600000,
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
