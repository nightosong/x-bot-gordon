# State Tracker Reference

`state-tracker` 用于维护长篇的世界状态、角色状态、经济流动、主题锚点和不可逆后果。它解决的是工程问题：防止战力漂移、势力失忆、人物瞬移、地图失效、资源无限、伤势蒸发和主题丢失。

## 核心目标

长篇必须有状态机。每一章不是孤立文本，而是对当前世界状态的一次增量修改。

状态机的原则：

- 规划前先读当前状态。
- 章节后只写状态差异。
- 伤势、资源、债务、通缉、信任、路线、价格和组织态度不能无解释清零。
- 重要冲突后至少产生一个不可逆后果。
- 世界必须记得人物做过什么。

## 状态更新优先级

```text
角色状态
> 路线 / 地图状态
> 组织 / 势力态度
> 资源 / 经济状态
> 怪物 / 生态状态
> 主题锚点
> 氛围备注
```

先保证人物和世界不会失真，再维护文学回响。

## World State Schema

```json
{
  "world_state": {
    "time": "",
    "weather": "",
    "globalThreatLevel": "",
    "routeStatus": [
      {
        "routeId": "",
        "status": "open | blocked | risky | controlled | unknown",
        "reason": "",
        "changedAt": "",
        "knownBy": []
      }
    ],
    "factionStatus": [
      {
        "factionId": "",
        "attitudeToProtagonist": "",
        "currentGoal": "",
        "recentLoss": "",
        "nextLikelyMove": ""
      }
    ],
    "resourcePrices": [
      {
        "resource": "",
        "priceTrend": "up | down | stable | unavailable",
        "driver": "",
        "affectedRegions": []
      }
    ],
    "monsterMigration": [
      {
        "speciesOrGroup": "",
        "route": "",
        "seasonOrTrigger": "",
        "humanImpact": ""
      }
    ],
    "cityAlerts": [
      {
        "regionId": "",
        "alert": "",
        "level": "",
        "authority": "",
        "effectOnTravel": ""
      }
    ]
  }
}
```

`world_state` 不追求完整模拟世界，只记录会影响后续章节的状态。

## Character State Schema

```json
{
  "character_state": [
    {
      "characterId": "",
      "location": "",
      "injury": "",
      "fatigue": "",
      "resources": [],
      "debts": [],
      "wantedLevel": "",
      "trustChanges": [
        {
          "targetId": "",
          "change": "",
          "evidence": ""
        }
      ],
      "secretsKnown": [],
      "promises": [],
      "currentGoal": "",
      "blockedBy": ""
    }
  ]
}
```

角色状态必须服务下一章行动。不要记录“他有点难过”这种不可操作描述，除非它会改变选择、关系或判断。

## Economic Flows Schema

经济系统回答：什么东西值钱。

```json
{
  "economicFlows": {
    "coreGoods": [
      {
        "name": "",
        "sourceRegion": "",
        "use": "",
        "whoControls": "",
        "whoRisksLife": ""
      }
    ],
    "tradeRoutes": [
      {
        "routeId": "",
        "goods": [],
        "controller": "",
        "taxOrFee": "",
        "currentRisk": ""
      }
    ],
    "scarcity": [
      {
        "resource": "",
        "cause": "",
        "whoSuffers": "",
        "whoProfits": ""
      }
    ],
    "priceDrivers": [],
    "illegalMarkets": [],
    "laborSystems": []
  }
}
```

真正推动世界的不是设定，而是什么东西值钱、谁控制它、谁为它死、谁靠短缺获利。

## Theme Anchors Schema

主题不能只停在口号，要有锚点。

```json
{
  "themeAnchors": [
    {
      "theme": "",
      "symbol": "",
      "characterConflict": "",
      "worldReflection": "",
      "payoffPlan": "",
      "currentStatus": "seeded | developed | challenged | paid_off"
    }
  ]
}
```

主题锚点包括：

- 一个可重复出现但意义会变化的象征物。
- 一个角色身上的价值冲突。
- 一个世界制度或经济关系中的反照。
- 一个未来回收计划。

例如“承诺是否仍有价值”可以挂到：桥票、口头约定、港口船期、角色不敢承诺、最终为一句承诺错过逃生机会。

## Irreversible Consequences Schema

```json
{
  "irreversibleConsequences": [
    {
      "id": "",
      "causedByChapter": "",
      "type": "route | faction | body | resource | reputation | ecology | relationship | rule | place",
      "description": "",
      "futureImpact": "",
      "cannotUndoBecause": ""
    }
  ]
}
```

不可逆后果不是为了虐，而是为了防止长篇变成每章清零的单元剧。

## 状态差异格式

章节后建议只输出 diff：

```json
{
  "state_diff": {
    "timeAdvanced": "",
    "locationChanges": [],
    "injuryChanges": [],
    "resourceChanges": [],
    "relationshipChanges": [],
    "routeChanges": [],
    "factionChanges": [],
    "economicChanges": [],
    "themeAnchorChanges": [],
    "irreversibleConsequencesAdded": []
  }
}
```

不要重写整个 `storyAssets`。状态差异越清楚，后续 Agent 越不容易覆盖旧资产。

## 状态读取流程

章节规划前读取：

1. 当前时间、天气、季节。
2. 主角和关键同行者的位置、伤势、疲劳、资源。
3. 当前路线是否开放，是否受组织控制。
4. 追兵、通缉、组织态度。
5. 当前地区价格、短缺和黑市。
6. 怪物迁徙、繁殖、禁区和生态扰动。
7. 当前阶段主题锚点。
8. 上一章不可逆后果。

若规划与状态冲突，先修状态或解释原因，再写章节。

## 状态写入流程

章节完成后更新：

1. 时间是否推进。
2. 位置是否变化。
3. 伤势和疲劳是否变化。
4. 资源是否增加、减少、损坏或被抵押。
5. 债务、承诺和秘密是否变化。
6. 关系信任是否变化。
7. 路线是否开放、关闭、失真或被控制。
8. 组织态度是否改变。
9. 价格、短缺或黑市是否变化。
10. 怪物生态是否被扰动。
11. 主题锚点是否推进。
12. 是否新增不可逆后果。

## 角色状态规则

### 伤势

伤势不能自动消失。

记录：

- 类型：割伤、骨折、中毒、烧伤、感染、异化、精神创伤。
- 严重程度。
- 行动限制。
- 恢复条件。
- 谁知道。

轻伤也要影响至少一章：握不稳、跑不快、不能下水、闻到药味暴露。

### 疲劳

疲劳是长篇真实感核心。

疲劳来源：

- 缺睡。
- 长途赶路。
- 饥饿。
- 失温。
- 情绪过载。
- 连续战斗。
- 使用能力代价。

疲劳影响判断、关系和动作，不只是“很累”一句。

### 资源

资源必须可数、可损耗或可失去。

记录：

- 钱、粮、水、药、灯油、弹药、票证、工具、怪物材料。
- 谁保管。
- 是否损坏。
- 是否被抵押。
- 是否会引来争夺。

资源无限会让冒险失去代价。

### 债务

债务包括钱债、人情债、命债、组织债、契约债、名声债。

债务应有：

- 债主。
- 到期或索取条件。
- 拒绝代价。
- 谁知道这笔债。

债务是非常好的长篇推进器。

## 路线状态规则

路线不是一直可用。

状态：

- 开放。
- 临时封闭。
- 季节不可达。
- 被组织控制。
- 被怪物迁徙覆盖。
- 只允许特定身份通行。
- 旧地图失效。
- 传闻可达但未验证。

路线变化要进入后续规划。不能上一章桥断，下一章像没事一样直达。

## 势力状态规则

势力会记仇，也会算账。

记录：

- 当前目标。
- 对主角态度。
- 最近损失。
- 知道主角哪些信息。
- 下一步可能反制。
- 内部派系是否分裂。

组织反应可以延迟，但不能消失。延迟本身可以成为压力。

## 经济状态规则

经济状态能让世界真实，也能推动剧情。

检查：

- 哪种核心商品短缺。
- 短缺由天气、战争、怪物、封路、垄断还是谣言造成。
- 谁承担涨价。
- 谁趁机获利。
- 黑市是否出现假货。
- 劳动者是否被迫冒更大风险。

经济变化要落到场景：药铺涨价、船票翻倍、盐税临时加收、孩子被送去做危险学徒。

## 怪物 / 生态状态规则

怪物生态会因人物行动变化。

记录：

- 某类怪物迁徙是否提前。
- 关键种是否被杀或被驱离。
- 尸体、巢穴、幼体是否改变当地风险。
- 材料价格是否变化。
- 人类职业是否调整禁忌。
- 组织是否利用生态变化征税或封路。

打怪后不更新生态，是怪物系统失真的主要原因。

## 主题状态规则

主题锚点必须逐步推进。

状态：

- `seeded`：已埋下象征或价值问题。
- `developed`：多次通过人物和世界反照出现。
- `challenged`：主角的旧判断被推翻。
- `paid_off`：在关键选择中兑现。

主题不要靠旁白说理。每次主题推进都应表现为人物选择、关系代价、经济关系、地图变化或制度后果。

## 状态与章节压缩

如果章节后没有任何状态差异：

- 位置未变。
- 资源未变。
- 关系未变。
- 身份未变。
- 规则理解未变。
- 伏笔未推进。
- 主题锚点未推进。

该章应标记为可压缩、合并或跳过。除非它承担明确的气氛恢复或关系小证据，否则不应完整展开。

## 常见失败诊断

| 失败 | 表现 | 修复 |
|---|---|---|
| 伤势蒸发 | 上章重伤，下章正常奔跑 | 写恢复条件和行动限制 |
| 资源无限 | 钱粮药票总有 | 记录数量、保管者和损耗 |
| 人物瞬移 | 无路线成本抵达 | 补路线状态、时间和交通 |
| 势力失忆 | 得罪组织后无反应 | 加延迟追责、封路、通缉或价格惩罚 |
| 地图失效 | 桥断、封路不影响后续 | 写路线 diff |
| 经济缺席 | 资源短缺不涨价 | 更新价格、黑市和劳动风险 |
| 主题丢失 | 后期只剩冒险 | 建立 themeAnchors 并在阶段回收 |
| 结局无重量 | 一切恢复原状 | 添加不可逆后果 |

## 输出偏好

状态任务优先输出：

1. 当前状态摘要。
2. 与本章 / 本阶段规划冲突的状态。
3. `state_diff`。
4. 新增不可逆后果。
5. 后续 3-5 章必须遵守的状态提醒。

## 审核清单

- 是否记录时间、天气或季节变化。
- 主角位置是否和路线状态一致。
- 伤势、疲劳、资源和债务是否延续。
- 组织和势力是否记得主角行为。
- 经济价格是否反映封路、短缺、战争、怪物或垄断。
- 怪物生态是否因战斗或迁徙改变。
- 主题锚点是否有推进和回收计划。
- 是否至少有一个不可逆后果进入账本。
- 状态更新是否为 diff，而不是整库重写。
