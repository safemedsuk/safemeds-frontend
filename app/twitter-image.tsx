import { ImageResponse } from 'next/og'
import { BrandCard, OG_IMAGE_SIZE } from '@/lib/og/brand-card'

export const alt = 'SafeMeds — The Pharmaceutical Compliance Standard'
export const size = OG_IMAGE_SIZE
export const contentType = 'image/png'

export default function TwitterImage() {
  return new ImageResponse(<BrandCard />, { ...size })
}
