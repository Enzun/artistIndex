import Link from 'next/link'

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-text text-bg flex items-center justify-center text-sm font-bold">
        {n}
      </div>
      <div>
        <p className="font-semibold text-sm mb-0.5">{title}</p>
        <p className="text-sm text-dim">{desc}</p>
      </div>
    </div>
  )
}

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-bg">

      {/* ── Hero ── */}
      <section className="bg-text text-bg px-6 py-20 text-center">
        <p className="text-xs tracking-widest uppercase text-bg/50 mb-6">Artist Index</p>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4">
          推しの勢いを、<br />指数で買え。
        </h1>
        <p className="text-bg/60 text-sm sm:text-base max-w-sm mx-auto mb-10 leading-relaxed">
          アーティストの「指数」をポイントで売買する、<br className="hidden sm:block" />
          音楽ファンのための推し活 × トレード。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="bg-bg text-text rounded-xl px-8 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            無料で始める
          </Link>
          <Link
            href="/preview"
            className="border border-bg/30 text-bg rounded-xl px-8 py-3 text-sm font-medium hover:bg-bg/10 transition-colors"
          >
            まず覗いてみる →
          </Link>
        </div>
      </section>

      {/* ── コンセプト ── */}
      <section className="px-6 py-16 max-w-2xl mx-auto text-center">
        <p className="text-xs tracking-widest uppercase text-dim mb-4">Concept</p>
        <p className="text-xl font-bold mb-4 leading-snug">
          推しのバズを、リターンにする。
        </p>
        <p className="text-sm text-dim leading-relaxed">
          アーティストが話題になるほど指数は上がり、あなたの保有ポイントも増える。<br />
          新曲のリリース前に買うのか、バズった後に売るのか。<br />
          音楽ファンとしての「読み」が、ここでは武器になる。
        </p>
      </section>

      {/* ── 使い方 ── */}
      <section className="px-6 pb-16 max-w-sm mx-auto">
        <p className="text-xs tracking-widest uppercase text-dim mb-8 text-center">How it works</p>
        <div className="flex flex-col gap-7">
          <Step
            n={1}
            title="アカウント登録"
            desc="メールアドレスだけで OK。登録すると初期ポイントがもらえます。"
          />
          <Step
            n={2}
            title="アーティストを選ぶ"
            desc="気になるアーティストの指数をチェック。前日比や推移グラフで勢いを確認。"
          />
          <Step
            n={3}
            title="買って、売る"
            desc="ポイントでカードを購入。指数が上がったタイミングで売却して利益を狙う。"
          />
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-surface border-t border-border px-6 py-16 text-center">
        <p className="font-bold text-lg mb-2">推しの指数、もう動いている。</p>
        <p className="text-sm text-dim mb-8">無料で参加して、今日から売買を始めよう。</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="bg-text text-bg rounded-xl px-8 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            無料で始める
          </Link>
          <Link
            href="/preview"
            className="border border-border text-text rounded-xl px-8 py-3 text-sm font-medium hover:border-dim transition-colors"
          >
            まず覗いてみる →
          </Link>
        </div>
      </section>

      {/* ── フッター ── */}
      <footer className="border-t border-border px-6 py-6 text-center">
        <div className="flex gap-4 justify-center text-xs text-dim mb-2">
          <Link href="/terms" className="hover:text-text transition-colors">利用規約</Link>
          <Link href="/privacy" className="hover:text-text transition-colors">プライバシーポリシー</Link>
        </div>
        <p className="text-xs text-dim">© 2026 Artist Index</p>
      </footer>

    </div>
  )
}
