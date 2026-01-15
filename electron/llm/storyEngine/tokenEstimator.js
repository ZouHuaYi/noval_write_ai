class TokenEstimator {
  static estimate(text) {
    if (!text) return 0
    // 粗略估算：中文 ~1.5 字 / token
    return Math.ceil(text.length / 1.5)
  }
}

module.exports = { TokenEstimator }