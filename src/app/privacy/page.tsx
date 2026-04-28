export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2">プライバシーポリシー</h1>
      <p className="text-xs text-dim mb-10">最終更新: 2026年4月</p>

      <div className="flex flex-col gap-8 text-sm leading-relaxed">

        <section>
          <h2 className="font-semibold mb-2">取得する情報</h2>
          <p className="text-dim mb-2">本サービスは以下の情報を取得します。</p>
          <ul className="text-dim space-y-1 list-disc list-inside">
            <li>メールアドレス（アカウント認証のため）</li>
            <li>サービス内の行動履歴（投資・売却・閲覧等）</li>
            <li>アクセスログ（IPアドレス、ブラウザ情報等）</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold mb-2">情報の利用目的</h2>
          <ul className="text-dim space-y-1 list-disc list-inside">
            <li>本サービスの提供・運営・改善</li>
            <li>ログイン認証・本人確認</li>
            <li>不正利用の検知・防止</li>
            <li>サービスに関するお知らせの送信</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold mb-2">第三者提供</h2>
          <p className="text-dim">
            取得した個人情報は、法令に基づく場合を除き、ご本人の同意なく第三者に提供しません。
          </p>
        </section>

        <section>
          <h2 className="font-semibold mb-2">利用している外部サービス</h2>
          <ul className="text-dim space-y-2">
            <li>
              <span className="font-medium text-text">Supabase</span>
              <span className="ml-2">— データベース・認証基盤として使用。メールアドレスおよびサービスデータを保存します。</span>
            </li>
            <li>
              <span className="font-medium text-text">YouTube Data API</span>
              <span className="ml-2">— アーティストの再生数データ取得に使用。ユーザーの個人情報は送信しません。</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold mb-2">Cookieについて</h2>
          <p className="text-dim">
            本サービスはログイン状態の維持にセッションCookieを使用します。ブラウザの設定によりCookieを無効にすることができますが、その場合サービスが正常に動作しないことがあります。
          </p>
        </section>

        <section>
          <h2 className="font-semibold mb-2">データの保管・削除</h2>
          <p className="text-dim">
            アカウントを削除した場合、関連する個人情報は速やかに削除します。ただしシステムの性質上、バックアップデータから完全に削除されるまでに一定の期間を要する場合があります。アカウント削除をご希望の場合はお問い合わせください。
          </p>
        </section>

        <section>
          <h2 className="font-semibold mb-2">ポリシーの変更</h2>
          <p className="text-dim">
            本ポリシーは必要に応じて変更することがあります。重要な変更がある場合はサービス内でお知らせします。
          </p>
        </section>

        <section>
          <h2 className="font-semibold mb-2">お問い合わせ</h2>
          <p className="text-dim">
            個人情報の取り扱いに関するお問い合わせは、サービス内のお問い合わせフォーム（準備中）よりご連絡ください。
          </p>
        </section>

      </div>
    </div>
  )
}
