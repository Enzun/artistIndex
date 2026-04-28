export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2">利用規約</h1>
      <p className="text-xs text-dim mb-10">最終更新: 2026年4月</p>

      <div className="flex flex-col gap-8 text-sm leading-relaxed">

        <section>
          <h2 className="font-semibold mb-2">第1条 本サービスについて</h2>
          <p className="text-dim">
            Artist Index（以下「本サービス」）は、アーティストの YouTube 再生数をもとに算出された「指数」を仮想ポイントで売買することを楽しむエンターテインメントサービスです。本サービスで使用するポイントは金銭的価値を持たず、現金への換金・払い戻しはできません。本サービスは投資・金融サービスではありません。
          </p>
        </section>

        <section>
          <h2 className="font-semibold mb-2">第2条 利用登録</h2>
          <p className="text-dim">
            メールアドレスを登録することで本サービスを利用できます。登録にあたり、正確な情報を提供してください。1人につき1アカウントの利用を原則とします。未成年者が利用する場合は保護者の同意を得てください。
          </p>
        </section>

        <section>
          <h2 className="font-semibold mb-2">第3条 禁止事項</h2>
          <ul className="text-dim space-y-1 list-disc list-inside">
            <li>複数アカウントの作成・使用</li>
            <li>システムの不正利用・脆弱性の悪用</li>
            <li>他のユーザーへの迷惑行為</li>
            <li>本サービスの運営を妨害する行為</li>
            <li>その他、運営が不適切と判断する行為</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold mb-2">第4条 ポイントについて</h2>
          <p className="text-dim">
            本サービスのポイントはサービス内でのみ使用できる仮想通貨であり、いかなる場合も現金や財産的価値のあるものとの交換はできません。運営の判断によりポイントの付与・調整を行う場合があります。
          </p>
        </section>

        <section>
          <h2 className="font-semibold mb-2">第5条 免責事項</h2>
          <p className="text-dim">
            本サービスはエンターテインメント目的であり、投資の助言・推奨を行うものではありません。指数の変動によるポイントの増減について、運営は一切の責任を負いません。システム障害・メンテナンス等により一時的にサービスを停止する場合があります。
          </p>
        </section>

        <section>
          <h2 className="font-semibold mb-2">第6条 サービスの変更・終了</h2>
          <p className="text-dim">
            運営は予告なく本サービスの内容を変更・追加・終了することがあります。サービス終了の場合、事前に通知するよう努めますが、やむを得ない事情がある場合はこの限りではありません。
          </p>
        </section>

        <section>
          <h2 className="font-semibold mb-2">第7条 規約の変更</h2>
          <p className="text-dim">
            本規約は必要に応じて変更することがあります。重要な変更がある場合はサービス内でお知らせします。変更後も本サービスを継続して利用した場合、変更後の規約に同意したものとみなします。
          </p>
        </section>

        <section>
          <h2 className="font-semibold mb-2">第8条 お問い合わせ</h2>
          <p className="text-dim">
            本規約に関するお問い合わせは、サービス内のお問い合わせフォーム（準備中）よりご連絡ください。
          </p>
        </section>

      </div>
    </div>
  )
}
