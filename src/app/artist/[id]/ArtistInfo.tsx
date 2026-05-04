import Image from 'next/image'

type Props = {
  channelId: string
  totalViews: number
  thumbnailUrl?: string | null
  description?: string | null
}

export default function ArtistInfo({ channelId, totalViews, thumbnailUrl, description }: Props) {
  const youtubeUrl = `https://www.youtube.com/channel/${channelId}`

  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-6">
      <div className="flex gap-4">
        {/* サムネイル */}
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt=""
            width={64}
            height={64}
            className="rounded-full flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-surface2 border border-border flex-shrink-0 flex items-center justify-center">
            <svg className="w-6 h-6 text-dim" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>
        )}

        {/* 情報 */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim mb-2">
            <span>総再生数: {totalViews.toLocaleString()}</span>
          </div>
          {description ? (
            <p className="text-xs text-dim whitespace-pre-wrap line-clamp-3">{description}</p>
          ) : (
            <p className="text-xs text-dim">——</p>
          )}
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-dim hover:text-text transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            YouTubeで見る
          </a>
        </div>
      </div>
    </div>
  )
}
