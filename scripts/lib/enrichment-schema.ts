/**
 * 增强结果（enrichment.json）的格式说明（JSON Schema），由 `scripts/lib/types.ts` 的 `EnrichmentState` 类型生成。
 * **勿手改**：改类型后跑 `npm run enrichment-schema -- --write` 回写（ADR-232）。
 */
export const ENRICHMENT_SCHEMA: Record<string, unknown> = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$ref": "#/definitions/EnrichmentState",
  "definitions": {
    "EnrichmentState": {
      "type": "object",
      "properties": {
        "version": {
          "type": "number",
          "const": 1
        },
        "updated_at": {
          "type": "string"
        },
        "accounts": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/AccountAssessment"
          }
        }
      },
      "required": [
        "version",
        "updated_at",
        "accounts"
      ],
      "additionalProperties": false
    },
    "AccountAssessment": {
      "type": "object",
      "properties": {
        "platform": {
          "$ref": "#/definitions/Platform"
        },
        "handle": {
          "type": "string"
        },
        "followers": {
          "type": "number"
        },
        "following": {
          "type": "number"
        },
        "sample": {
          "$ref": "#/definitions/ProfileSample"
        },
        "metrics": {
          "$ref": "#/definitions/PublicMetrics"
        },
        "collaboration_quote": {
          "$ref": "#/definitions/QuoteMeasurement"
        }
      },
      "required": [
        "platform",
        "handle"
      ],
      "additionalProperties": false
    },
    "Platform": {
      "type": "string",
      "enum": [
        "tiktok",
        "instagram"
      ]
    },
    "ProfileSample": {
      "$ref": "#/definitions/PublicPostMeasurement<NormalizedPublicPosts>",
      "description": "增强结果里存的主页作品样本。单起名字是为了生成的格式说明里定义名稳定： 泛型参数直接写成数组时，生成器给的定义名里带源码位置，类型文件挪一行就变。"
    },
    "PublicPostMeasurement<NormalizedPublicPosts>": {
      "type": "object",
      "properties": {
        "status": {
          "enum": [
            "measured",
            "unavailable"
          ]
        }
      },
      "required": [
        "status"
      ],
      "allOf": [
        {
          "if": {
            "properties": {
              "status": {
                "type": "string",
                "const": "measured"
              }
            }
          },
          "then": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "media_scope": {
                "$ref": "#/definitions/ProfileSampleScope"
              },
              "status": {
                "type": "string",
                "const": "measured"
              },
              "value": {
                "$ref": "#/definitions/NormalizedPublicPosts"
              },
              "source": {
                "$ref": "#/definitions/MetricSource"
              },
              "observed_at": {
                "type": "string"
              },
              "sample_size": {
                "type": "number"
              },
              "basis": {
                "type": "string"
              }
            },
            "required": [
              "basis",
              "observed_at",
              "sample_size",
              "source",
              "status",
              "value"
            ]
          }
        },
        {
          "if": {
            "properties": {
              "status": {
                "type": "string",
                "const": "unavailable"
              }
            }
          },
          "then": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "media_scope": {
                "$ref": "#/definitions/ProfileSampleScope"
              },
              "status": {
                "type": "string",
                "const": "unavailable"
              },
              "reason": {
                "$ref": "#/definitions/MetricUnavailableReason"
              },
              "source": {
                "$ref": "#/definitions/MetricSource"
              },
              "observed_at": {
                "type": "string"
              },
              "sample_size": {
                "type": "number"
              }
            },
            "required": [
              "observed_at",
              "reason",
              "source",
              "status"
            ]
          }
        }
      ]
    },
    "ProfileSampleScope": {
      "type": "string",
      "enum": [
        "provider_returned_first12",
        "legacy_video_filtered_first12",
        "unknown"
      ],
      "description": "主页样本实际保存的媒体范围；unknown 不代表确认图文或确认视频。"
    },
    "NormalizedPublicPosts": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/NormalizedPublicPost"
      }
    },
    "NormalizedPublicPost": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "video_confirmed": {
          "type": "boolean",
          "description": "仅肯定的视频证据为 true；false 只表示未见到肯定信号。"
        },
        "views": {
          "type": "number"
        },
        "likes": {
          "type": "number"
        },
        "comments": {
          "type": "number"
        },
        "shares": {
          "type": "number"
        },
        "published_at": {
          "type": "string"
        },
        "is_pinned": {
          "type": "boolean"
        }
      },
      "required": [
        "id"
      ],
      "additionalProperties": false,
      "description": "D8：关键词搜索命中的帖子有选择偏差，公开指标使用单独抓取的主页近期样本。"
    },
    "MetricSource": {
      "type": "object",
      "properties": {
        "kind": {
          "type": "string",
          "enum": [
            "public_api",
            "manual",
            "third_party"
          ]
        },
        "provider": {
          "type": "string"
        },
        "endpoint": {
          "type": "string"
        }
      },
      "required": [
        "kind",
        "provider"
      ],
      "additionalProperties": false,
      "description": "D8：所有会进入决策的派生指标都保留来源与测量状态。"
    },
    "MetricUnavailableReason": {
      "type": "string",
      "enum": [
        "private_account",
        "insufficient_posts",
        "missing_post_dates",
        "invalid_post_date",
        "missing_followers",
        "missing_following",
        "zero_denominator",
        "insufficient_peer_group",
        "insufficient_comparable_metrics",
        "unsupported_content",
        "account_unavailable",
        "unknown_sample_scope",
        "legacy_video_only_sample"
      ]
    },
    "PublicMetrics": {
      "type": "object",
      "properties": {
        "median_views": {
          "$ref": "#/definitions/Measurement<number>"
        },
        "median_engagements": {
          "$ref": "#/definitions/Measurement<number>"
        },
        "engagement_rate_followers": {
          "$ref": "#/definitions/Measurement<number>"
        },
        "engagement_rate_views": {
          "$ref": "#/definitions/Measurement<number>"
        },
        "view_rate": {
          "$ref": "#/definitions/Measurement<number>"
        },
        "following_ratio": {
          "$ref": "#/definitions/Measurement<number>"
        },
        "reach_consistency": {
          "$ref": "#/definitions/Measurement<number>"
        },
        "median_post_gap_days": {
          "$ref": "#/definitions/Measurement<number>"
        },
        "latest_post_at": {
          "$ref": "#/definitions/Measurement<string>"
        },
        "days_since_last_post": {
          "$ref": "#/definitions/Measurement<number>"
        },
        "activity_status": {
          "$ref": "#/definitions/Measurement<ActivityStatus>"
        },
        "audience_quality_risk": {
          "$ref": "#/definitions/Measurement<AudienceRiskAssessment>"
        }
      },
      "required": [
        "median_views",
        "median_engagements",
        "engagement_rate_followers",
        "engagement_rate_views",
        "view_rate",
        "following_ratio",
        "reach_consistency",
        "median_post_gap_days",
        "audience_quality_risk"
      ],
      "additionalProperties": false
    },
    "Measurement<number>": {
      "type": "object",
      "properties": {
        "status": {
          "enum": [
            "measured",
            "unavailable"
          ]
        }
      },
      "required": [
        "status"
      ],
      "allOf": [
        {
          "if": {
            "properties": {
              "status": {
                "type": "string",
                "const": "measured"
              }
            }
          },
          "then": {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "const": "measured"
              },
              "value": {
                "type": "number"
              },
              "source": {
                "$ref": "#/definitions/MetricSource"
              },
              "observed_at": {
                "type": "string"
              },
              "sample_size": {
                "type": "number"
              },
              "basis": {
                "type": "string"
              }
            },
            "required": [
              "status",
              "value",
              "source",
              "observed_at",
              "sample_size",
              "basis"
            ],
            "additionalProperties": false
          }
        },
        {
          "if": {
            "properties": {
              "status": {
                "type": "string",
                "const": "unavailable"
              }
            }
          },
          "then": {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "const": "unavailable"
              },
              "reason": {
                "$ref": "#/definitions/MetricUnavailableReason"
              },
              "source": {
                "$ref": "#/definitions/MetricSource"
              },
              "observed_at": {
                "type": "string"
              },
              "sample_size": {
                "type": "number"
              }
            },
            "required": [
              "status",
              "reason",
              "source",
              "observed_at"
            ],
            "additionalProperties": false
          }
        }
      ],
      "description": "三态里的两态：已测或不可用（未查询是整格缺席）。`@discriminator status` 让生成的格式说明按 status 分支， 报错只说那一支缺了什么（生成的格式说明在 `scripts/lib/enrichment-schema.ts`，ADR-232）。"
    },
    "Measurement<string>": {
      "type": "object",
      "properties": {
        "status": {
          "enum": [
            "measured",
            "unavailable"
          ]
        }
      },
      "required": [
        "status"
      ],
      "allOf": [
        {
          "if": {
            "properties": {
              "status": {
                "type": "string",
                "const": "measured"
              }
            }
          },
          "then": {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "const": "measured"
              },
              "value": {
                "type": "string"
              },
              "source": {
                "$ref": "#/definitions/MetricSource"
              },
              "observed_at": {
                "type": "string"
              },
              "sample_size": {
                "type": "number"
              },
              "basis": {
                "type": "string"
              }
            },
            "required": [
              "status",
              "value",
              "source",
              "observed_at",
              "sample_size",
              "basis"
            ],
            "additionalProperties": false
          }
        },
        {
          "if": {
            "properties": {
              "status": {
                "type": "string",
                "const": "unavailable"
              }
            }
          },
          "then": {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "const": "unavailable"
              },
              "reason": {
                "$ref": "#/definitions/MetricUnavailableReason"
              },
              "source": {
                "$ref": "#/definitions/MetricSource"
              },
              "observed_at": {
                "type": "string"
              },
              "sample_size": {
                "type": "number"
              }
            },
            "required": [
              "status",
              "reason",
              "source",
              "observed_at"
            ],
            "additionalProperties": false
          }
        }
      ],
      "description": "三态里的两态：已测或不可用（未查询是整格缺席）。`@discriminator status` 让生成的格式说明按 status 分支， 报错只说那一支缺了什么（生成的格式说明在 `scripts/lib/enrichment-schema.ts`，ADR-232）。"
    },
    "Measurement<ActivityStatus>": {
      "type": "object",
      "properties": {
        "status": {
          "enum": [
            "measured",
            "unavailable"
          ]
        }
      },
      "required": [
        "status"
      ],
      "allOf": [
        {
          "if": {
            "properties": {
              "status": {
                "type": "string",
                "const": "measured"
              }
            }
          },
          "then": {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "const": "measured"
              },
              "value": {
                "$ref": "#/definitions/ActivityStatus"
              },
              "source": {
                "$ref": "#/definitions/MetricSource"
              },
              "observed_at": {
                "type": "string"
              },
              "sample_size": {
                "type": "number"
              },
              "basis": {
                "type": "string"
              }
            },
            "required": [
              "status",
              "value",
              "source",
              "observed_at",
              "sample_size",
              "basis"
            ],
            "additionalProperties": false
          }
        },
        {
          "if": {
            "properties": {
              "status": {
                "type": "string",
                "const": "unavailable"
              }
            }
          },
          "then": {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "const": "unavailable"
              },
              "reason": {
                "$ref": "#/definitions/MetricUnavailableReason"
              },
              "source": {
                "$ref": "#/definitions/MetricSource"
              },
              "observed_at": {
                "type": "string"
              },
              "sample_size": {
                "type": "number"
              }
            },
            "required": [
              "status",
              "reason",
              "source",
              "observed_at"
            ],
            "additionalProperties": false
          }
        }
      ],
      "description": "三态里的两态：已测或不可用（未查询是整格缺席）。`@discriminator status` 让生成的格式说明按 status 分支， 报错只说那一支缺了什么（生成的格式说明在 `scripts/lib/enrichment-schema.ts`，ADR-232）。"
    },
    "ActivityStatus": {
      "type": "string",
      "enum": [
        "active",
        "cooling",
        "dormant"
      ]
    },
    "Measurement<AudienceRiskAssessment>": {
      "type": "object",
      "properties": {
        "status": {
          "enum": [
            "measured",
            "unavailable"
          ]
        }
      },
      "required": [
        "status"
      ],
      "allOf": [
        {
          "if": {
            "properties": {
              "status": {
                "type": "string",
                "const": "measured"
              }
            }
          },
          "then": {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "const": "measured"
              },
              "value": {
                "$ref": "#/definitions/AudienceRiskAssessment"
              },
              "source": {
                "$ref": "#/definitions/MetricSource"
              },
              "observed_at": {
                "type": "string"
              },
              "sample_size": {
                "type": "number"
              },
              "basis": {
                "type": "string"
              }
            },
            "required": [
              "status",
              "value",
              "source",
              "observed_at",
              "sample_size",
              "basis"
            ],
            "additionalProperties": false
          }
        },
        {
          "if": {
            "properties": {
              "status": {
                "type": "string",
                "const": "unavailable"
              }
            }
          },
          "then": {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "const": "unavailable"
              },
              "reason": {
                "$ref": "#/definitions/MetricUnavailableReason"
              },
              "source": {
                "$ref": "#/definitions/MetricSource"
              },
              "observed_at": {
                "type": "string"
              },
              "sample_size": {
                "type": "number"
              }
            },
            "required": [
              "status",
              "reason",
              "source",
              "observed_at"
            ],
            "additionalProperties": false
          }
        }
      ],
      "description": "三态里的两态：已测或不可用（未查询是整格缺席）。`@discriminator status` 让生成的格式说明按 status 分支， 报错只说那一支缺了什么（生成的格式说明在 `scripts/lib/enrichment-schema.ts`，ADR-232）。"
    },
    "AudienceRiskAssessment": {
      "type": "object",
      "properties": {
        "level": {
          "$ref": "#/definitions/AudienceRiskLevel"
        },
        "flags": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/AudienceRiskFlag"
          }
        },
        "peer_size": {
          "type": "number"
        }
      },
      "required": [
        "level",
        "flags",
        "peer_size"
      ],
      "additionalProperties": false
    },
    "AudienceRiskLevel": {
      "type": "string",
      "enum": [
        "low",
        "medium",
        "high"
      ]
    },
    "AudienceRiskFlag": {
      "type": "object",
      "properties": {
        "metric": {
          "$ref": "#/definitions/AudienceRiskMetric"
        },
        "direction": {
          "type": "string",
          "enum": [
            "low",
            "high"
          ]
        },
        "value": {
          "type": "number"
        },
        "threshold": {
          "type": "number"
        },
        "peer_size": {
          "type": "number"
        }
      },
      "required": [
        "metric",
        "direction",
        "value",
        "threshold",
        "peer_size"
      ],
      "additionalProperties": false
    },
    "AudienceRiskMetric": {
      "type": "string",
      "enum": [
        "engagement_rate_followers",
        "view_rate",
        "following_ratio"
      ]
    },
    "QuoteMeasurement": {
      "$ref": "#/definitions/ManualMeasurement<CollaborationQuote>",
      "description": "增强结果里存的合作报价"
    },
    "ManualMeasurement<CollaborationQuote>": {
      "type": "object",
      "properties": {
        "status": {
          "enum": [
            "measured",
            "unavailable"
          ]
        }
      },
      "required": [
        "status"
      ],
      "allOf": [
        {
          "if": {
            "properties": {
              "status": {
                "type": "string",
                "const": "measured"
              }
            }
          },
          "then": {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "const": "measured"
              },
              "value": {
                "$ref": "#/definitions/CollaborationQuote"
              },
              "source": {
                "$ref": "#/definitions/MetricSource"
              },
              "observed_at": {
                "type": "string"
              },
              "sample_size": {
                "type": "number"
              },
              "basis": {
                "type": "string"
              }
            },
            "required": [
              "status",
              "value",
              "source",
              "observed_at",
              "sample_size",
              "basis"
            ],
            "additionalProperties": false
          }
        },
        {
          "if": {
            "properties": {
              "status": {
                "type": "string",
                "const": "unavailable"
              }
            }
          },
          "then": {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "const": "unavailable"
              },
              "reason": {
                "type": "string",
                "minLength": 1
              },
              "source": {
                "$ref": "#/definitions/MetricSource"
              },
              "observed_at": {
                "type": "string"
              },
              "sample_size": {
                "type": "number"
              }
            },
            "required": [
              "status",
              "reason",
              "source",
              "observed_at"
            ],
            "additionalProperties": false
          }
        }
      ],
      "description": "手写那几格的三态包装：合作报价（D9），以及 render 从报价算出的隐含效率（不可用时沿用报价的原因）。 与指标那份只差在不可用时的原因：报价是用户或 Agent 手写的，文档教的是「报价查不到就写成不可用并写明原因」， 原因是一句话（例如「创作者未回复报价」），不限于指标那几个词；但不能是空的（ADR-232）。"
    },
    "CollaborationQuote": {
      "type": "object",
      "properties": {
        "amount": {
          "type": "number"
        },
        "currency": {
          "type": "string"
        },
        "platform": {
          "$ref": "#/definitions/Platform"
        },
        "format": {
          "type": "string",
          "enum": [
            "tiktok_video",
            "instagram_reel",
            "instagram_post",
            "mixed_bundle"
          ]
        },
        "quantity": {
          "type": "number"
        },
        "source": {
          "type": "string",
          "enum": [
            "creator_quote",
            "public_rate_card"
          ]
        },
        "observed_at": {
          "type": "string"
        }
      },
      "required": [
        "amount",
        "currency",
        "platform",
        "format",
        "quantity",
        "source",
        "observed_at"
      ],
      "additionalProperties": false,
      "description": "D9：报价必须带交付口径；混合套餐不得硬算成单条效率。"
    }
  }
}
