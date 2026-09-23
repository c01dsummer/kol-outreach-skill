/** D12 · 官方定价资产的来源与版本见 ADR-107 末尾；更新追加版本，不覆盖旧价。 */
import { CostError, type FixedPriceCatalog, type FrozenPrice } from '../lib/cost-ledger.js'

export const TIKHUB_PRICE_VERSION = 'tikhub-public-20260720-5d52fe8fb109'
export const TIKHUB_PRICE_BASIS = '固定公开基础价，不计优惠；不是实际账单，不保证供应商未来价格。'
export const TIKHUB_PRICE_CATALOG: FixedPriceCatalog = Object.freeze({
  [TIKHUB_PRICE_VERSION]: Object.freeze({
    '/api/v1/tiktok/app/v3/fetch_video_search_result': 1000,
    '/api/v1/tiktok/web/fetch_user_profile': 1000,
    '/api/v1/tiktok/app/v3/fetch_user_post_videos_v3': 1000,
    '/api/v1/instagram/v2/search_reels': 2000,
    '/api/v1/instagram/v2/search_users': 2000,
    '/api/v1/instagram/v1/fetch_user_info_by_username_v3': 1000,
    '/api/v1/instagram/v1/fetch_user_info_by_username_v2': 1000,
    '/api/v1/instagram/v2/fetch_user_posts': 2000,
  }),
})

export function resolveTikHubPrice(version: string, endpoint: string): FrozenPrice {
  if (typeof version !== 'string' || typeof endpoint !== 'string'
    || !Object.hasOwn(TIKHUB_PRICE_CATALOG, version) || !Object.hasOwn(TIKHUB_PRICE_CATALOG[version], endpoint))
    throw new CostError('unknown-price', 'TikHub 固定价目不含该版本或完整端点')
  return { endpoint, price_version: version, unit_micro_usd: TIKHUB_PRICE_CATALOG[version][endpoint] }
}

export const quoteTikHub = (endpoint: string): FrozenPrice => resolveTikHubPrice(TIKHUB_PRICE_VERSION, endpoint)
