#!/usr/bin/env python3
"""
Seed the local database + Qdrant with realistic test data.

Generates users (all @example.com, password "password123"), posts grouped into
semantic topic clusters (so the Sense-Distance ranker has real structure to
work with), POVs/tags, and optional likes/comments. Posts get batch-encoded
embeddings and are bulk-upserted into Qdrant.

Usage (from backend/, with infra up + migrated):
    ./.venv/bin/python seed.py                 # 12,000 posts, ~300 users
    ./.venv/bin/python seed.py --posts 20000 --users 500
    ./.venv/bin/python seed.py --fresh         # wipe test tables first
    ./.venv/bin/python seed.py --no-likes --no-comments

All seeded accounts share the password:  password123
"""
from __future__ import annotations

import argparse
import random
import uuid
from datetime import datetime, timedelta

from sqlalchemy import text

import numpy as np

from app.database import SessionLocal, engine, Post, POV, Like, Comment, User
from app.routers.auth import hash_password
from app.services.embedding_service import embedding_service
from app.services.qdrant_service import qdrant_service, COLLECTION_NAME, VECTOR_SIZE
from qdrant_client.models import PointStruct

random.seed(42)


def _normalize(v: "np.ndarray") -> "np.ndarray":
    n = np.linalg.norm(v)
    return (v / n).astype(np.float32) if n else v.astype(np.float32)

# --- Topic clusters: (tags pool, text templates). Mixed ja/en on purpose. ----
CLUSTERS = {
    "infra": {
        "tags": ["kubernetes", "k8s", "docker", "terraform", "aws", "gcp", "devops",
                 "observability", "sre", "platform engineering"],
        "ja": [
            "本番のKubernetesでオートスケールがやっと安定した。閾値をCPUからリクエスト同時数に変えたのが効いた。",
            "Terraformのstateをチームで共有し始めてから、深夜の手動オペがほぼ消えた。",
            "コスト最適化はインスタンスサイズより、まず使ってないボリュームとロードバランサを消すのが一番効く。",
            "監視はメトリクスよりまずログの構造化から。後から効いてくる投資だと痛感している。",
            "障害対応で学んだのは、ロールバックを1コマンドにしておくことが何より大事だということ。",
            "マネージドに寄せるほど運用は楽になるが、ベンダーロックインとのバランスは常に悩ましい。",
            "SREのエラーバジェットを真面目に運用したら、無駄なアラートが7割減った。",
            "コンテナのイメージサイズを削るだけでデプロイ時間が体感で半分になった。地味だが効く。",
            "インフラのコードレビューで一番見るのは権限の最小化。ここを雑にすると後で必ず痛い目を見る。",
            "可観測性は『なぜ遅いか』を5分で説明できる状態を指す。ダッシュボードの数ではない。",
            "オンコールを持つようになって、設計時に『3時に叩き起こされても直せるか』を考えるようになった。",
            "クラウド請求書を毎週見る習慣をつけたら、アーキテクチャの意思決定が現実的になった。",
        ],
        "en": [
            "Spent the day taming a Kubernetes rollout; switching the HPA from CPU to in-flight requests finally made it stable.",
            "Moving Terraform state into a shared backend killed almost all of our late-night manual ops.",
            "The cheapest cost win is rarely instance sizing — it's deleting the orphaned volumes and idle load balancers nobody owns.",
            "Observability isn't the number of dashboards; it's being able to explain why something is slow in five minutes.",
            "The biggest lesson from our last incident: make the rollback a single command before you ship anything.",
            "Trimming the container image cut our deploy time roughly in half. Unglamorous, but it compounds.",
            "Every infra review I do now starts with least-privilege — get that wrong and it hurts later, guaranteed.",
            "Going on-call changed how I design: I now ask whether I could fix this at 3am, half asleep.",
            "Managed services make ops easier but the lock-in trade-off never really goes away.",
            "We started reading the cloud bill every Friday and suddenly architecture decisions got a lot more grounded.",
            "Structured logging first, fancy metrics later — that ordering has paid off every single time.",
            "An error budget you actually enforce will delete more pager noise than any alerting tool.",
        ],
    },
    "data_ml": {
        "tags": ["machine learning", "vector search", "embeddings", "snowflake",
                 "data engineering", "nlp", "llm", "recommendation", "rag", "etl"],
        "ja": [
            "推薦に類似度だけを使うとエコーチェンバーになる。あえて『遠いけど価値観が重なる』投稿を混ぜると体験が変わる。",
            "ベクトル検索はインデックスの再構築を前提に設計すると一気に運用が楽になる。真実は別のDBに置く。",
            "埋め込みのモデルを変えるより、前処理を丁寧にする方が精度が上がることが多い。",
            "RAGは検索が9割。生成モデルを大きくする前に、まず検索の評価指標を整えるべきだった。",
            "レイテンシを半分にできた一番の要因は、候補生成と再ランクを分離したこと。",
            "データ基盤の負債は『誰も意味を説明できないカラム』として静かに溜まっていく。",
            "オフライン評価とオンラインの数字がずれる時、だいたい原因はログの取り方にある。",
            "次元削減はかっこいいが、まずは素朴な共起の集計が一番説明しやすくて強い。",
            "推薦の多様性をKPIに入れたら、短期のクリックは少し下がったが継続率が上がった。",
            "ETLは冪等にしておくと、障害から戻すのが怖くなくなる。これは精神衛生の投資。",
            "埋め込みの可視化をチームに見せると、モデルが何を『近い』と思っているかの議論が一気に進む。",
            "LLMに頼る前に、ルールベースで8割解ける問題なのかを必ず見積もるようにしている。",
        ],
        "en": [
            "Ranking on pure similarity quietly builds an echo chamber; mixing in 'far but shares a value' posts changes the whole feel.",
            "Design your vector index assuming you'll rebuild it; keep the source of truth somewhere else and operations get much calmer.",
            "More often than not, better preprocessing beats swapping the embedding model for accuracy.",
            "RAG is 90% retrieval. I should have fixed the retrieval metrics before reaching for a bigger generator.",
            "The single biggest latency win came from splitting candidate generation from reranking.",
            "Data debt accumulates silently as columns no one can explain the meaning of anymore.",
            "When offline eval and online numbers disagree, the culprit is usually how you logged things.",
            "Dimensionality reduction looks cool, but a plain co-occurrence count is often stronger and far easier to explain.",
            "We put recommendation diversity into the KPIs; short-term clicks dipped a little, retention went up.",
            "Make your ETL idempotent and recovering from failure stops being scary — it's an investment in sanity.",
            "Showing the team an embedding projection moves the 'what does the model think is similar' debate forward fast.",
            "Before reaching for an LLM I always estimate whether rules already solve 80% of the problem.",
        ],
    },
    "frontend": {
        "tags": ["react", "typescript", "vite", "tailwind", "ux", "design systems",
                 "accessibility", "frontend", "web performance", "animation"],
        "ja": [
            "良いコンポーネントは追加ではなく削除で完成することが多い。状態を一つ消すたびにバグも消える。",
            "アクセシビリティは最後の味付けではなく最初の制約として入れると、結局UIが綺麗になる。",
            "楽観的更新を入れたら『いいね』の体感が別物になった。サーバー応答を待つUIは想像以上に遅く感じる。",
            "デザインシステムは見た目の統一より『意思決定の数を減らす』ことに価値がある。",
            "Viteに移ってからビルド待ちのストレスが消えて、試行回数が増えた。これが一番の効果。",
            "TypeScriptの型は仕様書として読める。コメントより型を厚くする方が後で助かる。",
            "アニメーションは『気づかれないくらい』が上手い。派手さは初回だけ嬉しい。",
            "モバイル幅で先に作ると、情報の優先順位を強制的に考えることになって設計が締まる。",
            "パフォーマンスはバンドルサイズより、まず再レンダリングの回数を疑うのが早い。",
            "フォームのバリデーションはエラーの出し方が9割。文言ひとつで離脱率が変わる。",
            "ダークテーマは『黒に近い灰』とコントラストの設計が肝で、純黒は逆に読みにくい。",
            "UIの良し悪しは、迷わず次の操作に進めるかで決まる。装飾はその後の話。",
        ],
        "en": [
            "A good component is usually finished by deleting, not adding; every state you remove takes a bug with it.",
            "Treat accessibility as an upfront constraint, not a final garnish, and the UI ends up cleaner anyway.",
            "Optimistic updates made 'like' feel like a different product; waiting on the server is slower than you think.",
            "A design system's real value is reducing the number of decisions, not unifying the pixels.",
            "Since moving to Vite the build-wait stress is gone, so I just try more things — that's the actual win.",
            "Types read like a spec. Investing in stronger types pays off more than another comment.",
            "The best animation is the one you barely notice; flashy only delights on the first view.",
            "Designing mobile-first forces you to rank information, and that discipline tightens the whole layout.",
            "For performance, suspect re-render counts before bundle size — it's usually the faster path.",
            "Form validation is 90% about how you surface the error; one line of copy moves the drop-off rate.",
            "Dark themes live or die on near-black greys and contrast; pure black is actually harder to read.",
            "UI quality comes down to whether people reach the next action without hesitating; decoration comes after.",
        ],
    },
    "ethics_comm": {
        "tags": ["ethics", "communication", "philosophy", "society", "empathy",
                 "debate", "opinion", "community", "psychology", "values"],
        "ja": [
            "意見が違うこと自体は問題じゃない。共有する価値観が見えなくなった時に対立が壊れる。",
            "あえて自分と反対の立場の記事を読む習慣を続けている。腹は立つが、世界の解像度は上がる。",
            "議論で勝つことより、相手の前提を正確に言い換えられるかを大事にしたい。",
            "共感は同意ではない。同意できなくても理解しようとする姿勢が会話を生かす。",
            "SNSの設計は人の振る舞いを作る。仕組みが煽れば、優しい人でも刺々しくなる。",
            "遠い立場の人と一度ちゃんと話すと、相手も同じくらい怖がっていたと気づくことが多い。",
            "正しさを主張する前に、自分が間違っているかもしれない確率を口に出すと議論が柔らかくなる。",
            "コミュニティが健全かは、少数意見が安全に出せるかで測れると思う。",
            "倫理は答えの集合ではなく、迷い続けるための問いの作法に近い。",
            "言葉を選ぶことは弱さではない。むしろ相手を一人の人間として扱う最低限の礼儀だ。",
            "分断はアルゴリズムだけのせいではない。私たちが快適さを選び続けた結果でもある。",
            "対話の目的は説得ではなく、共有できる土台を一つ見つけること。それで十分前進だ。",
        ],
        "en": [
            "Disagreement itself isn't the problem; things break when the shared values stop being visible.",
            "I keep reading pieces I strongly disagree with. It's irritating, but my picture of the world gets sharper.",
            "I care less about winning an argument than about restating the other side's premise accurately.",
            "Empathy isn't agreement; trying to understand even when you can't agree is what keeps a conversation alive.",
            "Platform design shapes behavior — if the mechanics reward outrage, even kind people get sharp.",
            "Talk honestly with someone far from your view and you often find they were just as scared as you.",
            "Saying out loud that you might be wrong, before asserting you're right, softens almost any debate.",
            "You can measure a community's health by how safely a minority opinion can be voiced.",
            "Ethics is less a set of answers than a discipline for staying uncertain well.",
            "Choosing your words carefully isn't weakness; it's the minimum courtesy of treating someone as a person.",
            "Polarization isn't only the algorithm's fault — it's also the comfort we kept choosing.",
            "The goal of dialogue isn't persuasion but finding one shared piece of ground; that alone is progress.",
        ],
    },
    "lifestyle": {
        "tags": ["coffee", "travel", "running", "cooking", "books", "photography",
                 "minimalism", "music", "gardening", "tea"],
        "ja": [
            "朝のコーヒーを丁寧に淹れる10分が、一日の集中の質を決めている気がする。",
            "久しぶりに走り始めたら、考えごとが勝手に整理されていくのに驚いた。距離より頻度。",
            "物を減らすほど、本当に好きなものが何かがはっきりしてくる。ミニマリズムは引き算の発見だ。",
            "料理は失敗しても食べられる、というのが良い。コードと違って即フィードバックが返ってくる。",
            "旅は予定を詰めすぎないほうが記憶に残る。余白の時間に一番いい出会いがある。",
            "写真を撮るようになって、見慣れた通勤路にも光の良い瞬間があると気づけるようになった。",
            "積読が増えてきたので、月に一冊は最後まで読むと決めた。読了の満足は何にも代えがたい。",
            "お茶を淹れる所作には、急いでいる自分を一度止めるスイッチのような効果がある。",
            "ベランダで野菜を育て始めたら、天気予報を見る目が変わった。生活が少し地に足がついた。",
            "音楽は作業用と鑑賞用を分けると、どちらの時間も濃くなる。ながら聴きは贅沢を薄める。",
            "週末に何もしない時間を意図的に確保したら、平日の判断が速くなった。休息は生産性の一部だ。",
            "小さな習慣ほど効果は複利で効く。派手な決意より、続く仕組みを作るほうが勝つ。",
        ],
        "en": [
            "The ten careful minutes I spend on morning coffee seem to set the quality of the whole day's focus.",
            "Started running again and was surprised how it sorts my thoughts on its own — frequency beats distance.",
            "The less I own, the clearer it gets what I actually love; minimalism is discovery by subtraction.",
            "Cooking is forgiving — unlike code, the feedback is immediate and you can still eat the mistake.",
            "Trips stick in memory when you don't overschedule them; the best encounters happen in the empty hours.",
            "Since I started taking photos I notice that even my dull commute has moments of good light.",
            "My unread stack got tall, so I committed to finishing one book a month; nothing beats that satisfaction.",
            "Brewing tea works like a switch that stops the rushing version of me for a moment.",
            "Growing a few vegetables on the balcony changed how I read the weather forecast — life feels grounded.",
            "Splitting music into 'for work' and 'for listening' made both kinds of time richer.",
            "Deliberately protecting a do-nothing block on weekends made my weekday decisions faster; rest is part of output.",
            "Small habits compound; a system that lasts beats a dramatic resolution every time.",
        ],
    },
    "startup": {
        "tags": ["startup", "product", "growth", "fundraising", "hiring",
                 "go to market", "metrics", "founder", "pricing", "strategy"],
        "ja": [
            "スタートアップで一番難しいのは、良いが脇道なアイデアに『ノー』と言うこと。",
            "指標を一つに絞ったらチームの動きが明らかに速くなった。北極星は本当に一つでいい。",
            "採用は急ぐと必ず後で時間を失う。最初の10人はカルチャーそのものになる。",
            "価格は機能ではなく価値で決める。安く出すと、安さでしか選ばれない顧客が集まる。",
            "失敗から学んだのは、作る前に売れるかを確かめる順番を間違えないこと。",
            "資金調達は手段であって目的じゃない。調達額を自慢し始めたら危ない兆候だ。",
            "プロダクトの良し悪しは、ユーザーが友達に説明できる一文があるかで決まる。",
            "成長は派手な施策より、解約の理由を一つずつ潰す地味な作業の積み重ねだった。",
            "創業者の仕事の半分は、全員が同じ絵を見ている状態を作り直し続けること。",
            "最初の顧客10人とは過剰なくらい話す。スケールしないことをやる時期は確かにある。",
            "戦略とは『やらないことを決める』こと。全部やろうとした四半期は全部中途半端だった。",
            "市場投入は完璧を待つより、恥ずかしいくらい早く出して反応で学ぶ方が結局速い。",
        ],
        "en": [
            "The hardest part of a startup is saying no to good-but-distracting ideas.",
            "Narrowing to a single metric visibly sped the team up; you really only need one north star.",
            "Rush hiring and you lose the time later — the first ten people literally become the culture.",
            "Price on value, not features; sell cheap and you attract customers who only chose you for cheap.",
            "The lesson from getting it wrong twice: don't invert the order — validate demand before you build.",
            "Fundraising is a means, not the goal; bragging about the round size is an early warning sign.",
            "A product is good when the user has one sentence to explain it to a friend.",
            "Growth turned out to be the unglamorous work of killing churn reasons one at a time.",
            "Half a founder's job is continually rebuilding the state where everyone sees the same picture.",
            "Talk to your first ten customers excessively; there is a real season for doing things that don't scale.",
            "Strategy is deciding what not to do; the quarter I tried to do everything, everything came out half-done.",
            "Shipping embarrassingly early and learning from reactions beats waiting for perfect, almost every time.",
        ],
    },
    "ramen": {
        "tags": ["ラーメン", "二郎系", "家系", "豚骨", "醤油ラーメン", "味噌ラーメン",
                 "つけ麺", "替え玉", "背脂", "コール"],
        "ja": [
            "二郎系のコールはニンニクマシマシにしがちだけど、翌日のことを考えると普通で止める勇気も大事。",
            "家系は麺の硬さ・味の濃さ・油の量を全部『普通』で頼んで、まず店の基準を知るのが一番うまい食べ方だと思う。",
            "豚骨の替え玉はバリカタで頼んで、最後にスープを吸って柔らかくなったところを楽しむ派。",
            "つけ麺は割りスープがあるかで満足度が変わる。最後まで飲み干せる設計は店の優しさだと思う。",
            "二郎はロットを乱さないのがマナー。食べ切れる量をコールするまでが二郎だと教わった。",
            "家系のライスは、海苔でスープを吸わせてご飯に乗せる瞬間が一番の贅沢。",
            "札幌で食べた味噌ラーメンは別物だった。背脂と生姜の効かせ方がそもそも違う。",
            "塩ラーメンこそ店の実力が出る。誤魔化しが効かない正直なスープが好き。",
            "ヤサイマシは最初にカエシと絡めてから食べると、味がぼやけずに最後まで持つ。",
            "替え玉は博多の発明だと思う。一玉目は少なめ、二玉目で好みを攻めるのが楽しい。",
            "背脂は悪者にされがちだけど、適量はコクと甘みの源。要は塩分とのバランス。",
            "行列の時間も込みで一杯だと思っている。並んでいるあいだに期待が育つ。",
        ],
        "en": [
            "Jiro-style ramen is a ritual: the call — garlic, veg, fat, sauce — is half the experience.",
            "With iekei, order everything 'normal' first to learn the shop's baseline, then tune from there.",
            "Tonkotsu kaedama is best ordered firm, then softened in the last of the broth.",
            "A good tsukemen shop hands you broth to dilute at the end; finishing the bowl is a kindness.",
            "Back-fat gets a bad rap, but in the right amount it's where the richness and sweetness come from.",
        ],
    },
    "vtuber": {
        "tags": ["vtuber", "切り抜き", "スパチャ", "同接", "推し活",
                 "配信", "歌ってみた", "デビュー配信", "卒業", "箱推し"],
        "ja": [
            "推しの切り抜きから入って、気づいたら本配信を追ってる。これは界隈あるあるだと思う。",
            "赤スパを投げるか毎回悩むけど、好きな瞬間に感謝を残せるのは良い文化だと思っている。",
            "同接の数字だけで価値を測るのは違う。少人数の枠の濃さは数字には出ない。",
            "初見さんに優しい配信者は、コメントの拾い方が本当にうまい。",
            "新衣装お披露目や歌ってみたの投稿は、ファンにとってちょっとした祭りなんだよな。",
            "卒業配信は寂しいけど、最後まで前向きに送り出せるファンの空気が好き。",
            "箱推しになると、コラボのたびに関係性が深まっていくのが嬉しい。",
            "スパチャは投げ銭である前に、感謝を可視化する手段だと思っている。",
            "切り抜き師の編集センスで、同じ配信でも面白さが何倍にもなる。",
            "デビュー配信のあの初々しい緊張感は一度きり。何度見返しても良い。",
            "凸待ちや誕生日配信は、普段絡まない箱同士の関係が見られて楽しい。",
            "推し活は無理しない範囲で長く続けるのが一番。その方が結局しあわせ。",
        ],
        "en": [
            "You come for the clips and stay for the streams — that's the whole VTuber funnel.",
            "Concurrent-viewer counts don't capture how intense a small channel's chat can be.",
            "A red superchat is less a tip than a way to make gratitude visible in the moment.",
            "Clippers' editing turns the very same stream into something several times funnier.",
            "Debut and graduation streams hit hardest — fans growing up alongside a character is the whole appeal.",
        ],
    },
}
CLUSTER_NAMES = list(CLUSTERS.keys())

COMMENT_TEXTS = [
    "なるほど、その視点はなかった。", "完全に同意。", "ここ、もう少し詳しく聞きたい。",
    "I see it differently, but this is well put.", "Saved this — thanks for sharing.",
    "反対の立場だけど、考えさせられた。", "実体験に基づいていて説得力がある。",
    "This matches what we saw in production.", "後半の指摘が刺さった。", "自分も最近同じことを考えていた。",
]


def make_post_text(cluster_name: str) -> tuple[str, list[str]]:
    """Return (text, povs) for a realistic, multi-sentence post in the cluster.

    Samples several real sentences (one language per post) so posts read like
    actual people sharing a viewpoint, with the occasional cross-cluster POV to
    seed 'bridges' for the discovery ranker.
    """
    c = CLUSTERS[cluster_name]
    lang = "ja" if random.random() < 0.5 else "en"
    pool = c[lang]
    k = min(len(pool), random.randint(4, 9))
    sentences = random.sample(pool, k)
    text_str = "".join(sentences) if lang == "ja" else " ".join(sentences)

    n_pov = random.randint(2, 4)
    povs = set(random.sample(c["tags"], min(n_pov, len(c["tags"]))))
    # ~15% of posts borrow a POV from a different cluster (the "bridge" seed).
    if random.random() < 0.15:
        other = random.choice([n for n in CLUSTER_NAMES if n != cluster_name])
        povs.add(random.choice(CLUSTERS[other]["tags"]))
    return text_str, list(povs)


def truncate_test_data(db) -> None:
    print("  ⚠️  --fresh: truncating posts/povs/likes/comments/sessions/users ...")
    db.execute(text(
        "TRUNCATE TABLE pov_likes, povs, comments, likes, sessions, posts, users "
        "RESTART IDENTITY CASCADE"
    ))
    db.commit()
    try:
        from qdrant_client.models import Distance, VectorParams
        from app.services.qdrant_service import VECTOR_SIZE
        qdrant_service.client.delete_collection(collection_name=COLLECTION_NAME)
        qdrant_service.client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        print("  ✓ Qdrant collection recreated")
    except Exception as e:
        print(f"  ! Qdrant reset skipped: {e}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Seed test data into Postgres + Qdrant")
    ap.add_argument("--posts", type=int, default=12000)
    ap.add_argument("--users", type=int, default=300)
    ap.add_argument("--fresh", action="store_true", help="wipe test tables first")
    ap.add_argument("--no-likes", dest="likes", action="store_false")
    ap.add_argument("--no-comments", dest="comments", action="store_false")
    ap.add_argument("--batch", type=int, default=256, help="embedding batch size")
    ap.add_argument("--clusters", default="",
                    help="comma-separated clusters to generate from, e.g. "
                         "'ramen,vtuber'. Default: all topics.")
    ap.add_argument("--fake-vectors", action="store_true",
                    help="skip the embedding model; generate synthetic clustered "
                         "vectors. MUCH faster — use this for scale testing (millions).")
    args = ap.parse_args()

    gen_clusters = [c.strip() for c in args.clusters.split(",") if c.strip()] or CLUSTER_NAMES
    unknown = [c for c in gen_clusters if c not in CLUSTERS]
    if unknown:
        raise SystemExit(f"unknown clusters {unknown}; available: {CLUSTER_NAMES}")

    db = SessionLocal()
    try:
        if args.fresh:
            truncate_test_data(db)

        # Offset numbering by existing users so repeated runs don't collide.
        base = db.query(User).count()
        print(f"Seeding {args.users} users + {args.posts} posts "
              f"(existing users: {base}) ...")

        # --- Users (reuse one bcrypt hash for all seed accounts: fast) --------
        shared_hash = hash_password("password123")
        now = datetime.utcnow()
        user_rows, user_ids = [], []
        for i in range(args.users):
            n = base + i + 1
            uid = str(uuid.uuid4())
            user_ids.append((uid, f"seeduser{n}"))
            user_rows.append(dict(
                id=uid, username=f"seeduser{n}", email=f"seeduser{n}@example.com",
                password_hash=shared_hash, avatar_url=None,
                created_at=now, updated_at=now,
            ))
        db.bulk_insert_mappings(User, user_rows)
        db.commit()
        print(f"  ✓ {len(user_rows)} users")

        # --- Posts + POVs (build in memory, then batch-embed + bulk insert) ---
        post_rows, pov_rows, qdrant_meta, texts, post_clusters = [], [], [], [], []
        for _ in range(args.posts):
            uid, uname = random.choice(user_ids)
            cluster = random.choice(gen_clusters)
            body, povs = make_post_text(cluster)
            pid = str(uuid.uuid4())
            created = now - timedelta(
                days=random.randint(0, 60), minutes=random.randint(0, 1440))
            post_rows.append(dict(
                id=pid, user_id=uid, username=uname, text=body,
                created_at=created, updated_at=created))
            for p in povs:
                pov_rows.append(dict(
                    id=str(uuid.uuid4()), post_id=pid, pov=p,
                    is_auto=False, created_at=created))
            texts.append(body)
            post_clusters.append(cluster)
            qdrant_meta.append((pid, uid, povs, int(created.timestamp())))

        if args.fake_vectors:
            # Synthetic vectors with per-cluster centroids, so search still
            # returns topically coherent results without running the model.
            print(f"  • Generating {len(texts)} SYNTHETIC vectors (--fake-vectors) ...")
            rng = np.random.default_rng(42)
            centroids = {c: _normalize(rng.standard_normal(VECTOR_SIZE))
                         for c in CLUSTER_NAMES}
            idx = {c: i for i, c in enumerate(CLUSTER_NAMES)}
            cmat = np.stack([centroids[c] for c in CLUSTER_NAMES])
            cluster_ids = np.fromiter((idx[c] for c in post_clusters), dtype=np.int64)
            noise = rng.standard_normal((len(texts), VECTOR_SIZE)).astype(np.float32)
            vectors = cmat[cluster_ids] + 0.55 * noise
            vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
        else:
            print(f"  • Encoding {len(texts)} embeddings (batch={args.batch}) ...")
            embedding_service._ensure_initialized()
            vectors = embedding_service._model.encode(
                texts, batch_size=args.batch, show_progress_bar=True,
                convert_to_numpy=True)

        print("  • Bulk inserting posts + POVs into Postgres ...")
        for i in range(0, len(post_rows), 2000):
            db.bulk_insert_mappings(Post, post_rows[i:i + 2000])
            db.commit()
        for i in range(0, len(pov_rows), 5000):
            db.bulk_insert_mappings(POV, pov_rows[i:i + 5000])
            db.commit()
        print(f"  ✓ {len(post_rows)} posts, {len(pov_rows)} POVs")

        print("  • Upserting vectors into Qdrant ...")
        CHUNK = 1000
        for i in range(0, len(qdrant_meta), CHUNK):
            points = []
            for (pid, uid, povs, epoch), vec in zip(
                    qdrant_meta[i:i + CHUNK], vectors[i:i + CHUNK]):
                points.append(PointStruct(
                    id=pid, vector=vec.tolist(),
                    payload={"post_id": pid, "user_id": uid,
                             "tags": povs, "created_at": epoch}))
            qdrant_service.client.upsert(collection_name=COLLECTION_NAME, points=points)
            print(f"    {min(i + CHUNK, len(qdrant_meta))}/{len(qdrant_meta)}")
        print(f"  ✓ {len(qdrant_meta)} vectors in Qdrant")

        # --- Optional likes / comments ---------------------------------------
        if args.likes:
            like_rows, seen = [], set()
            for pid, _, _, _ in qdrant_meta:
                for _ in range(random.randint(0, 6)):
                    liker = random.choice(user_ids)[0]
                    if (pid, liker) in seen:
                        continue
                    seen.add((pid, liker))
                    like_rows.append(dict(id=str(uuid.uuid4()), post_id=pid,
                                          user_id=liker, created_at=now))
            for i in range(0, len(like_rows), 5000):
                db.bulk_insert_mappings(Like, like_rows[i:i + 5000])
                db.commit()
            print(f"  ✓ {len(like_rows)} likes")

        if args.comments:
            comment_rows = []
            for pid, _, _, _ in qdrant_meta:
                for _ in range(random.randint(0, 3)):
                    comment_rows.append(dict(
                        id=str(uuid.uuid4()), post_id=pid,
                        user_id=random.choice(user_ids)[0],
                        text=random.choice(COMMENT_TEXTS), created_at=now))
            for i in range(0, len(comment_rows), 5000):
                db.bulk_insert_mappings(Comment, comment_rows[i:i + 5000])
                db.commit()
            print(f"  ✓ {len(comment_rows)} comments")

        print("\n✅ Seed complete.")
        print(f"   Login with any of: seeduser{base + 1}@example.com .. "
              f"seeduser{base + args.users}@example.com")
        print("   Password: password123")
    finally:
        db.close()


if __name__ == "__main__":
    main()
