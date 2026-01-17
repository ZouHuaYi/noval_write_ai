/**
 * 图谱一致性检查器
 * 基于知识图谱的冲突检测和一致性验证
 */
const llmService = require('../llm/llmService')
const { safeParseJSON } = require('../utils/helpers')

/**
 * 冲突严重程度
 */
const SEVERITY = {
  CRITICAL: 'critical',  // 致命冲突，必须修复
  HIGH: 'high',          // 高严重性，强烈建议修复
  MEDIUM: 'medium',      // 中等严重性，建议修复
  LOW: 'low',            // 低严重性，可忽略
  INFO: 'info'           // 信息提示
}

/**
 * 冲突类型
 */
const CONFLICT_TYPES = {
  DEAD_CHARACTER_ACTIVE: 'dead_character_active',
  CONTRADICTORY_RELATION: 'contradictory_relation',
  LOCATION_CONFLICT: 'location_conflict',
  TIMELINE_CONFLICT: 'timeline_conflict',
  ABILITY_CONFLICT: 'ability_conflict',
  IDENTITY_CONFLICT: 'identity_conflict',
  RELATIONSHIP_CHANGE_ABRUPT: 'relationship_change_abrupt',
  MISSING_TRANSITION: 'missing_transition'
}

/**
 * 图谱一致性检查器类
 */
class GraphConsistencyChecker {
  constructor(graph) {
    this.graph = graph
  }

  /**
   * 执行完整的一致性检查
   */
  fullCheck() {
    const results = {
      conflicts: [],
      warnings: [],
      suggestions: [],
      stats: {
        totalChecks: 0,
        conflictsFound: 0,
        warningsFound: 0
      }
    }

    // 执行所有检查
    const checks = [
      this.checkDeadCharacters(),
      this.checkContradictoryRelations(),
      this.checkLocationConsistency(),
      this.checkTimelineConsistency(),
      this.checkRelationshipProgression(),
      this.checkOrphanNodes(),
      this.checkCircularRelations()
    ]

    checks.forEach(checkResult => {
      results.conflicts.push(...checkResult.conflicts)
      results.warnings.push(...checkResult.warnings)
      results.suggestions.push(...checkResult.suggestions)
      results.stats.totalChecks++
    })

    results.stats.conflictsFound = results.conflicts.length
    results.stats.warningsFound = results.warnings.length

    return results
  }

  /**
   * 检查死亡角色是否仍在活动
   */
  checkDeadCharacters() {
    const result = { conflicts: [], warnings: [], suggestions: [] }

    const characters = this.graph.getAllNodes('character')

    characters.forEach(char => {
      if (char.properties?.status === 'dead') {
        const deathChapter = char.properties.deathChapter || 0

        // 检查死后是否有活动
        const edges = this.graph.getNodeEdges(char.id)
        const postDeathEdges = edges.filter(e =>
          e.chapter && e.chapter > deathChapter && !e.type?.includes('memory')
        )

        if (postDeathEdges.length > 0) {
          result.conflicts.push({
            type: CONFLICT_TYPES.DEAD_CHARACTER_ACTIVE,
            severity: SEVERITY.CRITICAL,
            title: '死亡角色仍在活动',
            message: `角色「${char.label}」在第 ${deathChapter} 章死亡，但在之后的章节中仍有活动记录`,
            node: char.id,
            evidence: postDeathEdges.map(e => ({
              chapter: e.chapter,
              action: e.label || e.type
            })),
            suggestion: '请检查角色是否真的死亡，或修改相关章节内容'
          })
        }
      }
    })

    return result
  }

  /**
   * 检查矛盾关系
   */
  checkContradictoryRelations() {
    const result = { conflicts: [], warnings: [], suggestions: [] }

    // 定义矛盾的关系对
    const contradictions = {
      friend: ['enemy', 'rival'],
      enemy: ['friend', 'ally', 'lover'],
      ally: ['enemy', 'traitor'],
      lover: ['enemy', 'hates'],
      master: ['student'], // 同时互为师徒是矛盾的
      alive: ['dead']
    }

    // 按节点对分组所有边
    const nodePairEdges = new Map()
    this.graph.graph.forEachEdge((edgeId, attrs, source, target) => {
      const key = [source, target].sort().join('|')
      if (!nodePairEdges.has(key)) {
        nodePairEdges.set(key, [])
      }
      nodePairEdges.get(key).push({
        id: edgeId,
        source,
        target,
        ...attrs
      })
    })

    // 检查每对节点的关系
    nodePairEdges.forEach((edges, key) => {
      const relationTypes = edges.map(e => e.type)

      Object.entries(contradictions).forEach(([type, conflictsWith]) => {
        if (relationTypes.includes(type)) {
          const conflicts = conflictsWith.filter(t => relationTypes.includes(t))

          if (conflicts.length > 0) {
            const [node1, node2] = key.split('|')
            const node1Label = this.graph.getNode(node1)?.label || node1
            const node2Label = this.graph.getNode(node2)?.label || node2

            result.conflicts.push({
              type: CONFLICT_TYPES.CONTRADICTORY_RELATION,
              severity: SEVERITY.HIGH,
              title: '矛盾的关系',
              message: `「${node1Label}」和「${node2Label}」之间存在矛盾关系：${type} 与 ${conflicts.join(', ')}`,
              nodes: [node1, node2],
              relations: edges.filter(e =>
                e.type === type || conflicts.includes(e.type)
              ),
              suggestion: '请确认关系在故事中的变化，或添加关系转变的过渡'
            })
          }
        }
      })
    })

    return result
  }

  /**
   * 检查位置一致性
   */
  checkLocationConsistency() {
    const result = { conflicts: [], warnings: [], suggestions: [] }

    const characters = this.graph.getAllNodes('character')

    characters.forEach(char => {
      // 获取角色的位置相关边，按章节分组
      const locationEdges = this.graph.getNodeEdges(char.id, 'out')
        .filter(e => ['at', 'location', 'lives_in', 'travels_to'].includes(e.type))

      const chapterLocations = new Map()
      locationEdges.forEach(edge => {
        if (edge.chapter) {
          if (!chapterLocations.has(edge.chapter)) {
            chapterLocations.set(edge.chapter, [])
          }
          chapterLocations.get(edge.chapter).push({
            location: edge.target,
            type: edge.type
          })
        }
      })

      // 检查同一章节多个位置（排除 travels_to）
      chapterLocations.forEach((locations, chapter) => {
        const staticLocations = locations.filter(l => l.type !== 'travels_to')

        if (staticLocations.length > 1) {
          const locationNames = staticLocations.map(l =>
            this.graph.getNode(l.location)?.label || l.location
          )

          result.warnings.push({
            type: CONFLICT_TYPES.LOCATION_CONFLICT,
            severity: SEVERITY.MEDIUM,
            title: '位置可能冲突',
            message: `角色「${char.label}」在第 ${chapter} 章同时处于多个位置：${locationNames.join(', ')}`,
            node: char.id,
            chapter,
            locations: staticLocations,
            suggestion: '如果角色在章节中移动，请使用 travels_to 关系标记'
          })
        }
      })
    })

    return result
  }

  /**
   * 检查时间线一致性
   */
  checkTimelineConsistency() {
    const result = { conflicts: [], warnings: [], suggestions: [] }

    // 收集所有有章节标记的边
    const chapterEvents = new Map()
    this.graph.graph.forEachEdge((id, attrs, source, target) => {
      if (attrs.chapter) {
        if (!chapterEvents.has(attrs.chapter)) {
          chapterEvents.set(attrs.chapter, [])
        }
        chapterEvents.get(attrs.chapter).push({
          id,
          source,
          target,
          ...attrs
        })
      }
    })

    // 检查依赖关系是否违反时间线
    chapterEvents.forEach((events, chapter) => {
      events.forEach(event => {
        // 如果这个边有前置依赖，检查依赖是否在之前的章节
        if (event.dependsOn) {
          const dependencyEdge = this.graph.graph.getEdgeAttributes(event.dependsOn)
          if (dependencyEdge && dependencyEdge.chapter > chapter) {
            result.conflicts.push({
              type: CONFLICT_TYPES.TIMELINE_CONFLICT,
              severity: SEVERITY.HIGH,
              title: '时间线冲突',
              message: `第 ${chapter} 章的事件依赖于第 ${dependencyEdge.chapter} 章的事件（时间顺序颠倒）`,
              chapter,
              event: event,
              dependency: dependencyEdge,
              suggestion: '请调整章节顺序或修改事件依赖'
            })
          }
        }
      })
    })

    return result
  }

  /**
   * 检查关系变化的合理性
   */
  checkRelationshipProgression() {
    const result = { conflicts: [], warnings: [], suggestions: [] }

    // 定义关系变化的合理过渡
    const validTransitions = {
      stranger: ['acquaintance', 'enemy', 'friend'],
      acquaintance: ['friend', 'enemy', 'ally', 'rival'],
      friend: ['ally', 'lover', 'best_friend', 'enemy'], // 朋友可以反目
      enemy: ['rival', 'ally', 'friend'], // 化敌为友需要过渡
      ally: ['friend', 'enemy', 'betrayer']
    }

    // 追踪每对节点的关系历史
    const relationHistory = new Map()
    this.graph.graph.forEachEdge((id, attrs, source, target) => {
      if (!attrs.chapter) return

      const key = [source, target].sort().join('|')
      if (!relationHistory.has(key)) {
        relationHistory.set(key, [])
      }
      relationHistory.get(key).push({
        chapter: attrs.chapter,
        type: attrs.type,
        ...attrs
      })
    })

    // 分析关系变化
    relationHistory.forEach((history, key) => {
      if (history.length < 2) return

      // 按章节排序
      history.sort((a, b) => a.chapter - b.chapter)

      for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1]
        const curr = history[i]

        // 检查关系是否突变
        if (prev.type === 'friend' && curr.type === 'enemy' &&
          curr.chapter - prev.chapter === 1) {
          const [node1, node2] = key.split('|')

          result.warnings.push({
            type: CONFLICT_TYPES.RELATIONSHIP_CHANGE_ABRUPT,
            severity: SEVERITY.MEDIUM,
            title: '关系变化过于突然',
            message: `「${this.graph.getNode(node1)?.label}」和「${this.graph.getNode(node2)?.label}」在第 ${prev.chapter} 章是朋友，第 ${curr.chapter} 章突然成为敌人`,
            nodes: [node1, node2],
            transition: { from: prev, to: curr },
            suggestion: '建议添加关系恶化的过渡事件'
          })
        }
      }
    })

    return result
  }

  /**
   * 检查孤立节点
   */
  checkOrphanNodes() {
    const result = { conflicts: [], warnings: [], suggestions: [] }

    const nodes = this.graph.getAllNodes()

    nodes.forEach(node => {
      const edges = this.graph.getNodeEdges(node.id)

      if (edges.length === 0 && node.type === 'character') {
        result.suggestions.push({
          type: 'orphan_character',
          severity: SEVERITY.INFO,
          title: '孤立角色',
          message: `角色「${node.label}」没有与其他实体建立任何关系`,
          node: node.id,
          suggestion: '考虑为该角色添加与其他角色或地点的关系'
        })
      }
    })

    return result
  }

  /**
   * 检查循环依赖
   */
  checkCircularRelations() {
    const result = { conflicts: [], warnings: [], suggestions: [] }

    // 检测是否有循环的 master-student 关系
    const masterStudentPairs = []
    this.graph.graph.forEachEdge((id, attrs, source, target) => {
      if (attrs.type === 'master' || attrs.type === 'student') {
        masterStudentPairs.push({ source, target, type: attrs.type })
      }
    })

    // 检测 A 是 B 的师傅，B 也是 A 的师傅
    const checked = new Set()
    masterStudentPairs.forEach(pair => {
      const reverseKey = `${pair.target}-${pair.source}`
      if (checked.has(reverseKey)) return

      const reverse = masterStudentPairs.find(p =>
        p.source === pair.target && p.target === pair.source && p.type === pair.type
      )

      if (reverse) {
        result.conflicts.push({
          type: 'circular_relation',
          severity: SEVERITY.HIGH,
          title: '循环师徒关系',
          message: `「${this.graph.getNode(pair.source)?.label}」和「${this.graph.getNode(pair.target)?.label}」互为师徒，这通常是不可能的`,
          nodes: [pair.source, pair.target],
          suggestion: '请检查并修正师徒关系'
        })
      }

      checked.add(`${pair.source}-${pair.target}`)
    })

    return result
  }

  /**
   * 验证新内容是否与图谱一致
   * @param {string} content - 新内容
   * @param {number} chapter - 章节号
   */
  async validateNewContent(content, chapter) {
    const issues = []

    // 使用 LLM 提取内容中的实体和关系
    const systemPrompt = `你是一个故事一致性校验专家。请分析以下内容，检查是否与已知信息存在冲突。

已知信息：
${this.buildContextFromGraph()}

请检查新内容中：
1. 是否有角色做了与其设定不符的事
2. 是否有死亡角色出现
3. 是否有位置/时间矛盾
4. 是否有关系矛盾

返回 JSON 格式：
{
  "hasConflict": true/false,
  "conflicts": [
    {
      "type": "冲突类型",
      "description": "冲突描述",
      "excerpt": "相关文本片段",
      "suggestion": "修改建议"
    }
  ]
}`

    const userPrompt = `请检查以下第 ${chapter} 章内容是否与已知故事信息冲突：

${content.slice(0, 3000)}`

    try {
      const response = await llmService.callChatModel({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        maxTokens: 1500
      })

      const result = safeParseJSON(response)
      if (result?.conflicts) {
        issues.push(...result.conflicts)
      }
    } catch (error) {
      console.error('内容验证失败:', error)
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * 从图谱构建上下文信息
   */
  buildContextFromGraph() {
    const lines = []

    // 角色信息
    const characters = this.graph.getAllNodes('character').slice(0, 20)
    if (characters.length > 0) {
      lines.push('【角色状态】')
      characters.forEach(char => {
        let status = char.properties?.status || '活着'
        if (char.properties?.status === 'dead') {
          status = `已在第 ${char.properties.deathChapter || '?'} 章死亡`
        }
        lines.push(`- ${char.label}: ${status}`)
      })
    }

    // 重要关系
    lines.push('\n【重要关系】')
    const importantRelations = []
    this.graph.graph.forEachEdge((id, attrs, source, target) => {
      if (['enemy', 'lover', 'family', 'master', 'student'].includes(attrs.type)) {
        const srcLabel = this.graph.getNode(source)?.label
        const tgtLabel = this.graph.getNode(target)?.label
        if (srcLabel && tgtLabel) {
          importantRelations.push(`- ${srcLabel} 和 ${tgtLabel}: ${attrs.label || attrs.type}`)
        }
      }
    })
    lines.push(...importantRelations.slice(0, 15))

    // 地点
    const locations = this.graph.getAllNodes('location').slice(0, 10)
    if (locations.length > 0) {
      lines.push('\n【已知地点】')
      lines.push(locations.map(l => l.label).join(', '))
    }

    return lines.join('\n')
  }
}

/**
 * 创建检查器实例
 */
function createChecker(graph) {
  return new GraphConsistencyChecker(graph)
}

module.exports = {
  GraphConsistencyChecker,
  createChecker,
  SEVERITY,
  CONFLICT_TYPES
}
