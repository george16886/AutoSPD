"""Generate extension/_locales/<lang>/messages.json from the table below.

Keeping every language on one row makes a missing translation impossible.
$1, $2 are substitutions passed to t(key, ...).

Run from the repository root after editing:  python tools/make-locales.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCALES = ("en", "zh_TW", "zh_CN", "ja", "ko")

# key: (en, zh_TW, zh_CN, ja, ko)
MESSAGES = {
    # --- Manifest ---
    "extName": (
        "AutoSPD for YouTube — AI Smart Playback Speed",
        "AutoSPD for YouTube — AI 智慧播放速度",
        "AutoSPD for YouTube — AI 智能播放速度",
        "AutoSPD for YouTube — AI スマート再生速度",
        "AutoSPD for YouTube — AI 스마트 재생 속도",
    ),
    "extDescription": (
        "Sets YouTube playback speed by video content: keywords, YouTube categories or on-device AI. Channel rules; live and music stay 1x.",
        "依影片內容自動調整 YouTube 播放速度：用關鍵字、YouTube 分類或本機 AI 判斷，支援頻道規則，直播與音樂固定 1x。",
        "根据视频内容自动调整 YouTube 播放速度：通过关键词、YouTube 分类或本地 AI 判断，支持频道规则，直播与音乐固定 1x。",
        "動画の内容に合わせて YouTube の再生速度を自動調整。キーワード、YouTube カテゴリ、端末内 AI で判定。チャンネルルール対応、ライブと音楽は 1x 固定。",
        "영상 내용에 따라 YouTube 재생 속도를 자동 조절합니다. 키워드, YouTube 카테고리, 기기 내 AI로 판단하며 채널 규칙을 지원하고 라이브와 음악은 1x로 고정합니다.",
    ),
    # --- Popup ---
    "popupSubtitle": ("AI smart playback speed for YouTube", "AI 智慧播放速度 for YouTube", "AI 智能播放速度 for YouTube", "YouTube 向け AI スマート再生速度", "YouTube용 AI 스마트 재생 속도"),
    "currentVideo": ("Current video", "目前影片", "当前视频", "現在の動画", "현재 영상"),
    "checkingTab": ("Checking the YouTube tab…", "正在檢查 YouTube 分頁…", "正在检查 YouTube 标签页…", "YouTube のタブを確認中…", "YouTube 탭을 확인하는 중…"),
    "loading": ("Loading", "讀取中", "读取中", "読み込み中", "불러오는 중"),
    "defaultSpeedLabel": ("Default speed for uncategorized videos", "未分類影片的預設速度", "未分类视频的默认速度", "未分類の動画の既定の速度", "미분류 영상의 기본 속도"),
    "save": ("Save", "儲存", "保存", "保存", "저장"),
    "set": ("Set", "設定", "设置", "設定", "설정"),
    "remove": ("Remove", "移除", "移除", "削除", "제거"),
    "apply": ("Apply", "套用", "应用", "適用", "적용"),
    "channelRuleDefault": ("Always use for this channel", "這個頻道一律使用", "此频道始终使用", "このチャンネルで常に使用", "이 채널에 항상 사용"),
    "channelRuleLabel": ("Always use for “$1”", "「$1」的影片一律使用", "“$1”的视频始终使用", "「$1」の動画で常に使用", "'$1' 영상에 항상 사용"),
    "channelRuleLabelSet": ("Always use for “$1” (set)", "「$1」的影片一律使用（已設定）", "“$1”的视频始终使用（已设置）", "「$1」の動画で常に使用（設定済み）", "'$1' 영상에 항상 사용 (설정됨)"),
    "manualLabel": ("Apply to this video only", "只套用到目前影片", "仅应用于当前视频", "この動画にのみ適用", "이 영상에만 적용"),
    "autoSpeedTitle": ("Automatic speed", "自動分類調速", "自动分类调速", "自動速度調整", "자동 속도 조절"),
    "autoSpeedHint": ("Set the speed from the video and your rules", "依影片標題和分類規則套用速度", "根据视频标题和分类规则应用速度", "動画の情報とルールに基づいて速度を適用", "영상 정보와 규칙에 따라 속도 적용"),
    "hideCaptionsTitle": ("Turn off CC captions", "自動關閉 CC 字幕", "自动关闭 CC 字幕", "CC 字幕を自動でオフ", "CC 자막 자동 끄기"),
    "hideCaptionsHint": ("Turn off captions YouTube switches on by itself", "影片開始時關閉 YouTube 自動開啟的字幕", "视频开始时关闭 YouTube 自动开启的字幕", "YouTube が自動でオンにした字幕を動画の開始時にオフ", "YouTube가 자동으로 켠 자막을 영상 시작 시 끄기"),
    "notificationsTitle": ("Show speed notice", "顯示速度提示", "显示速度提示", "速度の通知を表示", "속도 알림 표시"),
    "notificationsHint": ("Show the category and speed on the video when it changes", "換影片時在影片左上角顯示分類和速度", "切换视频时在视频左上角显示分类和速度", "動画の切り替え時に左上へカテゴリと速度を表示", "영상이 바뀔 때 왼쪽 위에 카테고리와 속도 표시"),
    "manageCategories": ("Manage categories and keywords →", "管理分類與關鍵字 →", "管理分类与关键词 →", "カテゴリとキーワードを管理 →", "카테고리와 키워드 관리 →"),
    "speedRange": ("Speed range: 0.25x–2x", "速度範圍：0.25x–2x", "速度范围：0.25x–2x", "速度の範囲：0.25x～2x", "속도 범위: 0.25x–2x"),
    "openYouTube": ("Open a YouTube video in this tab first", "請先在此分頁開啟 YouTube 影片", "请先在此标签页打开 YouTube 视频", "このタブで YouTube の動画を開いてください", "먼저 이 탭에서 YouTube 영상을 여세요"),
    "notConnected": ("Not connected", "尚未連線", "尚未连接", "未接続", "연결되지 않음"),
    "loadingVideoInfo": ("Loading video info…", "正在載入影片資訊…", "正在加载视频信息…", "動画の情報を読み込み中…", "영상 정보를 불러오는 중…"),
    "playerUnreachable": ("Can't reach the YouTube player", "無法連線至 YouTube 播放器", "无法连接到 YouTube 播放器", "YouTube プレーヤーに接続できません", "YouTube 플레이어에 연결할 수 없습니다"),
    "reloadTab": ("Reload the YouTube tab and try again", "請重新整理 YouTube 分頁後再試", "请刷新 YouTube 标签页后重试", "YouTube のタブを再読み込みしてお試しください", "YouTube 탭을 새로고침한 후 다시 시도하세요"),
    "loadFailed": ("Couldn't load", "載入失敗", "加载失败", "読み込みに失敗しました", "불러오지 못했습니다"),
    "noVideoToControl": ("There's no YouTube video to control.", "目前沒有可控制的 YouTube 影片。", "当前没有可控制的 YouTube 视频。", "操作できる YouTube の動画がありません。", "제어할 수 있는 YouTube 영상이 없습니다."),
    "speedRangeError": ("Enter a speed between 0.25 and 2.", "請輸入 0.25 到 2 之間的速度。", "请输入 0.25 到 2 之间的速度。", "0.25～2 の速度を入力してください。", "0.25에서 2 사이의 속도를 입력하세요."),
    "metaYouTubeCategory": ("YouTube category: $1", "YouTube 分類：$1", "YouTube 分类：$1", "YouTube カテゴリ：$1", "YouTube 카테고리: $1"),
    "metaChannel": ("Channel: $1", "頻道：$1", "频道：$1", "チャンネル：$1", "채널: $1"),
    "aiDownloadable": ("AI model not downloaded; download it in Settings", "AI 模型尚未下載，請到設定頁下載", "AI 模型尚未下载，请到设置页下载", "AI モデルが未ダウンロードです。設定ページからダウンロードしてください", "AI 모델이 다운로드되지 않았습니다. 설정 페이지에서 다운로드하세요"),
    "aiDownloading": ("AI model downloading", "AI 模型下載中", "AI 模型下载中", "AI モデルをダウンロード中", "AI 모델 다운로드 중"),
    "aiUnavailable": ("This computer can't run AI analysis", "這台電腦無法使用 AI 分析", "这台电脑无法使用 AI 分析", "このパソコンでは AI 分析を使用できません", "이 컴퓨터에서는 AI 분석을 사용할 수 없습니다"),
    "aiUnsupported": ("This Chrome version doesn't support AI analysis", "這個版本的 Chrome 不支援 AI 分析", "此版本的 Chrome 不支持 AI 分析", "このバージョンの Chrome は AI 分析に対応していません", "이 Chrome 버전은 AI 분석을 지원하지 않습니다"),
    "aiTimeout": ("AI analysis timed out", "AI 分析逾時", "AI 分析超时", "AI 分析がタイムアウトしました", "AI 분석 시간이 초과되었습니다"),
    "aiFailed": ("AI analysis failed ($1)", "AI 分析失敗（$1）", "AI 分析失败（$1）", "AI 分析に失敗しました（$1）", "AI 분석 실패 ($1)"),
    "statusAutoOff": ("Automatic speed is off", "自動調速已關閉", "自动调速已关闭", "自動速度調整はオフです", "자동 속도 조절이 꺼져 있습니다"),
    "statusNotVideo": ("This tab isn't a video page", "目前分頁不是影片頁", "当前标签页不是视频页", "このタブは動画ページではありません", "이 탭은 영상 페이지가 아닙니다"),
    "statusError": ("Couldn't apply; reload the page", "套用失敗，請重新整理頁面", "应用失败，请刷新页面", "適用できませんでした。ページを再読み込みしてください", "적용하지 못했습니다. 페이지를 새로고침하세요"),
    "statusDetecting": ("Working out the video type…", "正在判斷影片類型…", "正在判断视频类型…", "動画の種類を判定中…", "영상 종류를 판단하는 중…"),
    "autoSpeedOn": ("Automatic speed on", "自動調速已開啟", "自动调速已开启", "自動速度調整をオンにしました", "자동 속도 조절을 켰습니다"),
    "saveFailed": ("Couldn't save the setting", "設定儲存失敗", "设置保存失败", "設定を保存できませんでした", "설정을 저장하지 못했습니다"),
    "noticeOn": ("Speed notice on", "速度提示已開啟", "速度提示已开启", "速度の通知をオンにしました", "속도 알림을 켰습니다"),
    "noticeOff": ("Speed notice off", "速度提示已關閉", "速度提示已关闭", "速度の通知をオフにしました", "속도 알림을 껐습니다"),
    "captionsOn": ("Captions will be turned off on videos you open next", "之後開啟的影片會自動關閉字幕", "之后打开的视频会自动关闭字幕", "今後開く動画で字幕を自動でオフにします", "앞으로 여는 영상의 자막을 자동으로 끕니다"),
    "captionsOff": ("Stopped turning captions off", "已停止自動關閉字幕", "已停止自动关闭字幕", "字幕の自動オフを停止しました", "자막 자동 끄기를 중지했습니다"),
    "channelRuleSaved": ("Videos from “$1” will now use $2x", "「$1」的影片之後都會使用 $2x", "“$1”的视频之后都会使用 $2x", "「$1」の動画は今後 $2x を使用します", "'$1' 영상에 앞으로 $2x를 사용합니다"),
    "channelRuleRemoved": ("Removed the rule for “$1”", "已移除「$1」的頻道規則", "已移除“$1”的频道规则", "「$1」のチャンネルルールを削除しました", "'$1' 채널 규칙을 제거했습니다"),
    "defaultSpeedSaved": ("Default speed saved as $1x", "未分類影片預設速度已儲存為 $1x", "未分类视频默认速度已保存为 $1x", "未分類の動画の既定の速度を $1x に保存しました", "미분류 영상의 기본 속도를 $1x로 저장했습니다"),
    "manualApplied": ("This video is now at $1x", "目前影片已設定為 $1x", "当前视频已设置为 $1x", "この動画を $1x に設定しました", "이 영상을 $1x로 설정했습니다"),
    "manualFailed": ("Couldn't apply the speed", "無法套用播放速度", "无法应用播放速度", "再生速度を適用できませんでした", "재생 속도를 적용하지 못했습니다"),
    # --- Toast and matcher labels ---
    "toastSpeed": ("AutoSPD: $1 · $2x", "AutoSPD：$1 · $2x", "AutoSPD：$1 · $2x", "AutoSPD：$1 · $2x", "AutoSPD: $1 · $2x"),
    "toastManual": ("AutoSPD: set to $1x", "AutoSPD：已手動設定為 $1x", "AutoSPD：已手动设置为 $1x", "AutoSPD：手動で $1x に設定しました", "AutoSPD: 수동으로 $1x로 설정했습니다"),
    "uncategorized": ("Uncategorized", "未分類", "未分类", "未分類", "미분류"),
    "errCannotApply": ("Can't apply this speed right now", "目前無法套用這個播放速度", "当前无法应用此播放速度", "現在この再生速度は適用できません", "지금은 이 재생 속도를 적용할 수 없습니다"),
    "labelLive": ("Live", "直播", "直播", "ライブ", "라이브"),
    "labelMusic": ("Music / MV", "音樂 / MV", "音乐 / MV", "音楽 / MV", "음악 / MV"),
    "labelReplay": ("Live replay", "直播重播", "直播回放", "ライブのアーカイブ", "라이브 다시보기"),
    "labelYouTube": ("YouTube: $1", "YouTube：$1", "YouTube：$1", "YouTube：$1", "YouTube: $1"),
    "labelChannel": ("Channel: $1", "頻道：$1", "频道：$1", "チャンネル：$1", "채널: $1"),
    "labelAi": ("$1 (AI)", "$1（AI）", "$1（AI）", "$1（AI）", "$1 (AI)"),
    # --- YouTube categories ---
    "ytCategory1": ("Film & Animation", "電影與動畫", "电影与动画", "映画とアニメ", "영화/애니메이션"),
    "ytCategory2": ("Autos & Vehicles", "汽車", "汽车", "自動車と乗り物", "자동차/교통"),
    "ytCategory10": ("Music", "音樂", "音乐", "音楽", "음악"),
    "ytCategory15": ("Pets & Animals", "寵物與動物", "宠物与动物", "ペットと動物", "동물"),
    "ytCategory17": ("Sports", "體育", "体育", "スポーツ", "스포츠"),
    "ytCategory19": ("Travel & Events", "旅遊與活動", "旅游与活动", "旅行とイベント", "여행/이벤트"),
    "ytCategory20": ("Gaming", "遊戲", "游戏", "ゲーム", "게임"),
    "ytCategory22": ("People & Blogs", "人物與網誌", "人物与博客", "ブログ", "인물/블로그"),
    "ytCategory23": ("Comedy", "喜劇", "喜剧", "コメディー", "코미디"),
    "ytCategory24": ("Entertainment", "娛樂", "娱乐", "エンターテイメント", "엔터테인먼트"),
    "ytCategory25": ("News & Politics", "新聞與政治", "新闻与政治", "ニュースと政治", "뉴스/정치"),
    "ytCategory26": ("Howto & Style", "DIY 與生活百科", "DIY 与生活百科", "ハウツーとスタイル", "노하우/스타일"),
    "ytCategory27": ("Education", "教育", "教育", "教育", "교육"),
    "ytCategory28": ("Science & Technology", "科學與技術", "科学与技术", "科学と技術", "과학기술"),
    "ytCategory29": ("Nonprofits & Activism", "非營利組織與行動主義", "非营利组织与社会活动", "非営利団体と社会活動", "비영리/사회운동"),
    # --- Settings page ---
    "optionsTitle": ("AutoSPD category settings", "AutoSPD 分類設定", "AutoSPD 分类设置", "AutoSPD カテゴリ設定", "AutoSPD 카테고리 설정"),
    "optionsHeading": ("Category settings", "分類設定", "分类设置", "カテゴリ設定", "카테고리 설정"),
    "optionsIntro": ("Choose how videos are classified, then set a playback speed for each category.", "選擇影片要怎麼分類，再為每個分類設定播放速度。", "选择视频的分类方式，再为每个分类设置播放速度。", "動画の分類方法を選び、カテゴリごとに再生速度を設定します。", "영상 분류 방식을 선택하고 카테고리별 재생 속도를 설정하세요."),
    "modeLegend": ("Classification method", "分類方式", "分类方式", "分類方法", "분류 방식"),
    "modeKeywordsTitle": ("Keywords", "關鍵字分類", "关键词分类", "キーワード分類", "키워드 분류"),
    "modeKeywordsHint": (
        "Match the video's title, tags and channel against your categories and keywords, as specific as the content you watch. If nothing matches, the YouTube category's speed is used.",
        "依影片標題、標籤、頻道名稱比對你設定的分類與關鍵字，可以細分到你常看的內容類型。都沒有符合時，改用 YouTube 分類的速度。",
        "根据视频标题、标签、频道名称匹配你设置的分类与关键词，可以细分到你常看的内容类型。都不匹配时，改用 YouTube 分类的速度。",
        "動画のタイトル、タグ、チャンネル名をカテゴリとキーワードに照合します。よく見る内容に合わせて細かく分類できます。一致しない場合は YouTube カテゴリの速度を使います。",
        "영상 제목, 태그, 채널 이름을 설정한 카테고리와 키워드에 대조합니다. 자주 보는 내용에 맞게 세분화할 수 있습니다. 일치하는 항목이 없으면 YouTube 카테고리의 속도를 사용합니다.",
    ),
    "modeYouTubeTitle": ("YouTube categories", "YouTube 分類", "YouTube 分类", "YouTube カテゴリ", "YouTube 카테고리"),
    "modeYouTubeHint": (
        "Use the YouTube category the uploader chose. Stable and unaffected by titles, but broad: most talk shows sit in Entertainment or People & Blogs.",
        "使用上傳者為影片選的 YouTube 分類。結果穩定、不受標題影響，但分類比較粗，例如大部分談話節目都在「娛樂」或「人物與網誌」。",
        "使用上传者为视频选择的 YouTube 分类。结果稳定、不受标题影响，但分类较粗，例如大部分谈话节目都在“娱乐”或“人物与博客”。",
        "投稿者が選んだ YouTube カテゴリを使います。結果は安定しタイトルの影響を受けませんが、分類は大まかです。トーク番組の多くは「エンターテイメント」や「ブログ」に入ります。",
        "업로더가 선택한 YouTube 카테고리를 사용합니다. 결과가 안정적이고 제목의 영향을 받지 않지만 분류가 넓습니다. 대부분의 토크 영상은 '엔터테인먼트'나 '인물/블로그'에 속합니다.",
    ),
    "modeAiTitle": ("AI content analysis (experimental)", "AI 內容分析（實驗性）", "AI 内容分析（实验性）", "AI コンテンツ分析（試験運用）", "AI 콘텐츠 분석 (실험적)"),
    "modeAiHint": (
        "Chrome's built-in AI model (Gemini Nano, running on your computer; nothing is uploaded) works out what a video is really about, ignoring sensational titles, and picks one of your categories below. The video starts at the keyword speed and is corrected after a second or two. Each video is analyzed once.",
        "由 Chrome 內建的 AI 模型（Gemini Nano，在你的電腦上執行，資料不會上傳）判斷影片實際在講什麼，不受聳動標題影響，再對應到下方的分類。影片會先用關鍵字結果調速，約 1～2 秒後依 AI 判斷修正；每支影片只判斷一次。",
        "由 Chrome 内置的 AI 模型（Gemini Nano，在你的电脑上运行，数据不会上传）判断视频实际在讲什么，不受耸动标题影响，再对应到下方的分类。视频会先按关键词结果调速，约 1～2 秒后根据 AI 判断修正；每个视频只判断一次。",
        "Chrome 内蔵の AI モデル（Gemini Nano。パソコン上で動作し、データはアップロードされません）が動画の実際の内容を判定し、煽るようなタイトルに惑わされず下のカテゴリに割り当てます。動画はまずキーワードの結果で速度を設定し、1～2 秒後に AI の判定で修正します。分析は動画ごとに 1 回だけです。",
        "Chrome에 내장된 AI 모델(Gemini Nano, 컴퓨터에서 실행되며 데이터를 업로드하지 않음)이 자극적인 제목에 흔들리지 않고 영상의 실제 내용을 판단해 아래 카테고리에 연결합니다. 영상은 먼저 키워드 결과로 속도를 맞춘 뒤 1~2초 후 AI 판단에 따라 수정됩니다. 영상마다 한 번만 분석합니다.",
    ),
    "aiDownloadButton": ("Download AI model", "下載 AI 模型", "下载 AI 模型", "AI モデルをダウンロード", "AI 모델 다운로드"),
    "keywordHelp": (
        "A category applies when the title, tags or channel contain one of its keywords, or its YouTube category matches. English keywords match whole words (TED won't match “tested”); other languages match text. Separate keywords with commas or new lines.",
        "影片標題、標籤或頻道名稱含有關鍵字，或 YouTube 分類相符時，就套用該分類的速度。英文關鍵字以整個單字比對（例如 TED 不會比對到 tested），中文以字串比對。多個關鍵字用逗號、頓號或換行分隔。",
        "视频标题、标签或频道名称含有关键词，或 YouTube 分类相符时，就应用该分类的速度。英文关键词按整个单词匹配（例如 TED 不会匹配 tested），中文按字符串匹配。多个关键词用逗号、顿号或换行分隔。",
        "タイトル、タグ、チャンネル名にキーワードが含まれるか、YouTube カテゴリが一致すると、そのカテゴリの速度を適用します。英語のキーワードは単語単位で照合し（TED は tested に一致しません）、日本語は文字列で照合します。キーワードはカンマ、読点、改行で区切ります。",
        "제목, 태그, 채널 이름에 키워드가 있거나 YouTube 카테고리가 일치하면 해당 카테고리의 속도를 적용합니다. 영어 키워드는 단어 단위로 대조하고(TED는 tested와 일치하지 않음) 한국어는 문자열로 대조합니다. 키워드는 쉼표나 줄바꿈으로 구분합니다.",
    ),
    "addCategory": ("+ Add category", "＋ 新增分類", "＋ 新增分类", "+ カテゴリを追加", "+ 카테고리 추가"),
    "resetCategories": ("Restore default categories", "還原預設分類", "恢复默认分类", "既定のカテゴリに戻す", "기본 카테고리로 복원"),
    "ytSpeedsHeading": ("YouTube category speeds", "YouTube 分類速度", "YouTube 分类速度", "YouTube カテゴリの速度", "YouTube 카테고리 속도"),
    "ytHintYouTubeMode": (
        "Videos with no YouTube category use “Default speed for uncategorized videos” in the popup.",
        "沒有 YouTube 分類資訊的影片，會使用彈出視窗裡「未分類影片的預設速度」。",
        "没有 YouTube 分类信息的视频，会使用弹出窗口里的“未分类视频的默认速度”。",
        "YouTube カテゴリの情報がない動画には、ポップアップの「未分類の動画の既定の速度」を使います。",
        "YouTube 카테고리 정보가 없는 영상은 팝업의 '미분류 영상의 기본 속도'를 사용합니다.",
    ),
    "ytHintFallback": (
        "When a video matches none of the categories above, these speeds apply by its YouTube category. “Default speed for uncategorized videos” is only used when YouTube reports no category.",
        "影片沒有符合上方任何分類時，依它的 YouTube 分類套用這裡的速度。沒有 YouTube 分類資訊時，才使用「未分類影片的預設速度」。",
        "视频不符合上方任何分类时，根据其 YouTube 分类应用这里的速度。没有 YouTube 分类信息时，才使用“未分类视频的默认速度”。",
        "上のどのカテゴリにも一致しない動画には、YouTube カテゴリに応じてここの速度を適用します。YouTube カテゴリの情報がない場合のみ「未分類の動画の既定の速度」を使います。",
        "위 카테고리에 해당하지 않는 영상은 YouTube 카테고리에 따라 이 속도를 적용합니다. YouTube 카테고리 정보가 없을 때만 '미분류 영상의 기본 속도'를 사용합니다.",
    ),
    "liveMusicHeading": ("Live and music", "直播與音樂", "直播与音乐", "ライブと音楽", "라이브와 음악"),
    "liveMusicHint": ("“Fixed 1x” beats every category and channel rule. You can still change the speed by hand.", "「固定 1x」優先於所有分類與頻道規則。你仍然可以自己手動調整速度。", "“固定 1x”优先于所有分类与频道规则。你仍然可以手动调整速度。", "「1x 固定」はすべてのカテゴリとチャンネルルールより優先されます。手動で速度を変更することはできます。", "'1x 고정'은 모든 카테고리와 채널 규칙보다 우선합니다. 수동으로 속도를 바꿀 수는 있습니다."),
    "fixedLiveTitle": ("Keep live streams at 1x", "直播固定 1x", "直播固定 1x", "ライブを 1x に固定", "라이브 1x 고정"),
    "fixedLiveHint": ("Videos that are live right now. Replays of finished streams aren't affected.", "正在直播的影片。直播結束後的重播不受影響。", "正在直播的视频。直播结束后的回放不受影响。", "配信中の動画が対象です。終了後のアーカイブには影響しません。", "현재 생방송 중인 영상입니다. 종료 후 다시보기에는 영향을 주지 않습니다."),
    "fixedMusicTitle": ("Keep music / MV at 1x", "音樂 / MV 固定 1x", "音乐 / MV 固定 1x", "音楽 / MV を 1x に固定", "음악 / MV 1x 고정"),
    "fixedMusicHint": (
        "YouTube's Music category, auto-generated “- Topic” channels, or titles and tags with terms like MV, Official Video, lyrics, concert, fancam or Inkigayo.",
        "YouTube 分類為音樂、YouTube 自動產生的「- Topic」音樂頻道，或標題、標籤含 MV、Official Video、歌詞、演唱會、直拍、인기가요 等字樣。",
        "YouTube 分类为音乐、YouTube 自动生成的“- Topic”音乐频道，或标题、标签含 MV、Official Video、歌词、演唱会、直拍、인기가요 等字样。",
        "YouTube の音楽カテゴリ、自動生成の「- Topic」チャンネル、またはタイトルやタグに MV、Official Video、歌ってみた、인기가요 などを含む動画。",
        "YouTube 음악 카테고리, 자동 생성된 '- Topic' 채널, 또는 제목이나 태그에 MV, Official Video, 직캠, 인기가요 등이 포함된 영상입니다.",
    ),
    "replayTitle": ("Speed up live replays", "直播重播加速", "直播回放加速", "ライブのアーカイブを高速化", "라이브 다시보기 빠르게"),
    "replayHint": (
        "Replays of finished streams are usually long. When no category matches, this speed applies before the YouTube category speed. Channel rules and categories still win.",
        "直播結束後的重播通常很長。沒有符合任何分類時，先用這個速度，才輪到 YouTube 分類的速度。頻道規則和分類仍然優先。",
        "直播结束后的回放通常很长。不符合任何分类时，先用这个速度，才轮到 YouTube 分类的速度。频道规则和分类仍然优先。",
        "配信のアーカイブは長いことが多いです。どのカテゴリにも一致しないとき、YouTube カテゴリの速度より先にこの速度を使います。チャンネルルールとカテゴリが優先されます。",
        "방송 다시보기는 보통 깁니다. 어떤 카테고리에도 해당하지 않으면 YouTube 카테고리 속도보다 먼저 이 속도를 사용합니다. 채널 규칙과 카테고리가 우선합니다.",
    ),
    "replaySpeedLabel": ("Live replay speed", "直播重播速度", "直播回放速度", "ライブのアーカイブの速度", "라이브 다시보기 속도"),
    "channelRulesHeading": ("Channel rules", "頻道規則", "频道规则", "チャンネルルール", "채널 규칙"),
    "channelRulesHint": (
        "Channel rules beat every category, except fixed 1x for live and music. Open the AutoSPD popup on a video page to set a speed for that channel.",
        "頻道規則優先於所有分類（直播、音樂的「固定 1x」除外）。在 YouTube 影片頁打開 AutoSPD 彈出視窗，就能為目前影片的頻道設定速度。",
        "频道规则优先于所有分类（直播、音乐的“固定 1x”除外）。在 YouTube 视频页打开 AutoSPD 弹出窗口，即可为当前视频的频道设置速度。",
        "チャンネルルールはすべてのカテゴリより優先されます（ライブと音楽の「1x 固定」を除く）。動画ページで AutoSPD のポップアップを開くと、そのチャンネルの速度を設定できます。",
        "채널 규칙은 모든 카테고리보다 우선합니다(라이브와 음악의 '1x 고정' 제외). 영상 페이지에서 AutoSPD 팝업을 열면 해당 채널의 속도를 설정할 수 있습니다.",
    ),
    "noChannelRules": ("No channel rules yet.", "還沒有頻道規則。", "还没有频道规则。", "チャンネルルールはまだありません。", "아직 채널 규칙이 없습니다."),
    "unsavedChanges": ("Unsaved changes", "有未儲存的變更", "有未保存的更改", "未保存の変更があります", "저장되지 않은 변경 사항이 있습니다"),
    "enableCategory": ("Enable this category", "啟用這個分類", "启用此分类", "このカテゴリを有効にする", "이 카테고리 사용"),
    "enable": ("Enable", "啟用", "启用", "有効", "사용"),
    "iconLabel": ("Icon", "圖示", "图标", "アイコン", "아이콘"),
    "categoryNameLabel": ("Category name", "分類名稱", "分类名称", "カテゴリ名", "카테고리 이름"),
    "playbackSpeedLabel": ("Playback speed", "播放速度", "播放速度", "再生速度", "재생 속도"),
    "deleteCategory": ("Delete category", "刪除分類", "删除分类", "カテゴリを削除", "카테고리 삭제"),
    "delete": ("Delete", "刪除", "删除", "削除", "삭제"),
    "keywordsLabel": ("Keywords", "關鍵字", "关键词", "キーワード", "키워드"),
    "keywordsPlaceholder": ("e.g. unboxing, review, hands-on", "例如：開箱, unboxing, 評測", "例如：开箱, unboxing, 评测", "例：開封, レビュー, unboxing", "예: 언박싱, 리뷰, unboxing"),
    "ytCategoryOptional": ("YouTube category (optional)", "YouTube 分類（選填）", "YouTube 分类（选填）", "YouTube カテゴリ（任意）", "YouTube 카테고리 (선택)"),
    "channelSpeedLabel": ("Channel speed", "頻道速度", "频道速度", "チャンネルの速度", "채널 속도"),
    "notSpecified": ("None", "不指定", "不指定", "指定なし", "지정 안 함"),
    "speedOfCategory": ("Playback speed for $1", "$1的播放速度", "$1的播放速度", "$1の再生速度", "$1 재생 속도"),
    "nthCategory": ("Category $1", "第 $1 個分類", "第 $1 个分类", "$1 番目のカテゴリ", "$1번째 카테고리"),
    "errCategoryName": ("$1: enter a category name.", "$1：請輸入分類名稱。", "$1：请输入分类名称。", "$1：カテゴリ名を入力してください。", "$1: 카테고리 이름을 입력하세요."),
    "errCategoryDuplicate": ("“$1” is a duplicate; use a different name.", "「$1」重複了，請使用不同的分類名稱。", "“$1”重复了，请使用不同的分类名称。", "「$1」が重複しています。別の名前にしてください。", "'$1'이(가) 중복됩니다. 다른 이름을 사용하세요."),
    "errCategorySpeed": ("Speed for “$1” must be between $2 and $3.", "「$1」的速度必須介於 $2 到 $3 之間。", "“$1”的速度必须介于 $2 到 $3 之间。", "「$1」の速度は $2～$3 にしてください。", "'$1'의 속도는 $2에서 $3 사이여야 합니다."),
    "errCategoryMatchers": ("“$1” needs a keyword or a YouTube category, or it will never match a video.", "「$1」至少要有一個關鍵字或指定 YouTube 分類，否則不會比對到任何影片。", "“$1”至少要有一个关键词或指定 YouTube 分类，否则不会匹配到任何视频。", "「$1」にはキーワードか YouTube カテゴリが必要です。ないと動画に一致しません。", "'$1'에는 키워드나 YouTube 카테고리가 필요합니다. 없으면 어떤 영상과도 일치하지 않습니다."),
    "errYtSpeed": ("Speed for YouTube category “$1” must be between $2 and $3.", "YouTube 分類「$1」的速度必須介於 $2 到 $3 之間。", "YouTube 分类“$1”的速度必须介于 $2 到 $3 之间。", "YouTube カテゴリ「$1」の速度は $2～$3 にしてください。", "YouTube 카테고리 '$1'의 속도는 $2에서 $3 사이여야 합니다."),
    "errChannelSpeed": ("Speed for channel “$1” must be between $2 and $3.", "頻道「$1」的速度必須介於 $2 到 $3 之間。", "频道“$1”的速度必须介于 $2 到 $3 之间。", "チャンネル「$1」の速度は $2～$3 にしてください。", "채널 '$1'의 속도는 $2에서 $3 사이여야 합니다."),
    "errReplaySpeed": ("Live replay speed must be between $1 and $2.", "直播重播的速度必須介於 $1 到 $2 之間。", "直播回放的速度必须介于 $1 到 $2 之间。", "ライブのアーカイブの速度は $1～$2 にしてください。", "라이브 다시보기 속도는 $1에서 $2 사이여야 합니다."),
    "aiNoChrome": ("This Chrome version doesn't support built-in AI. Update Chrome or use another method.", "這個版本的 Chrome 不支援內建 AI。請更新 Chrome，或改用其他分類方式。", "此版本的 Chrome 不支持内置 AI。请更新 Chrome，或改用其他分类方式。", "このバージョンの Chrome は内蔵 AI に対応していません。Chrome を更新するか、別の分類方法を使ってください。", "이 Chrome 버전은 내장 AI를 지원하지 않습니다. Chrome을 업데이트하거나 다른 분류 방식을 사용하세요."),
    "aiReady": ("✓ AI model ready", "✓ AI 模型已就緒", "✓ AI 模型已就绪", "✓ AI モデルの準備ができました", "✓ AI 모델 준비 완료"),
    "aiNeedsDownload": ("The AI model must be downloaded first (several GB, once only).", "使用前需要先下載 AI 模型（數 GB，只需下載一次）。", "使用前需要先下载 AI 模型（数 GB，只需下载一次）。", "先に AI モデルのダウンロードが必要です（数 GB、初回のみ）。", "먼저 AI 모델을 다운로드해야 합니다(수 GB, 최초 1회)."),
    "aiDownloadingWait": ("AI model downloading; it will be used when finished…", "AI 模型下載中，完成後就會開始使用…", "AI 模型下载中，完成后就会开始使用…", "AI モデルをダウンロード中です。完了すると使用を開始します…", "AI 모델 다운로드 중입니다. 완료되면 사용을 시작합니다…"),
    "aiNoHardware": ("This computer doesn't meet Chrome's built-in AI requirements. Use another method.", "這台電腦不符合 Chrome 內建 AI 的硬體需求，請改用其他分類方式。", "这台电脑不符合 Chrome 内置 AI 的硬件要求，请改用其他分类方式。", "このパソコンは Chrome 内蔵 AI のハードウェア要件を満たしていません。別の分類方法を使ってください。", "이 컴퓨터는 Chrome 내장 AI의 하드웨어 요구 사항을 충족하지 않습니다. 다른 분류 방식을 사용하세요."),
    "aiCheckFailed": ("Couldn't check the AI model: $1", "無法檢查 AI 模型：$1", "无法检查 AI 模型：$1", "AI モデルを確認できませんでした：$1", "AI 모델을 확인하지 못했습니다: $1"),
    "aiDownloadProgress": ("AI model downloading… $1%", "AI 模型下載中… $1%", "AI 模型下载中… $1%", "AI モデルをダウンロード中… $1%", "AI 모델 다운로드 중… $1%"),
    "aiDownloadFailed": ("Download failed: $1", "下載失敗：$1", "下载失败：$1", "ダウンロードに失敗しました：$1", "다운로드 실패: $1"),
    "confirmReset": ("Restore the default categories? Categories you added or edited will be cleared.", "確定要還原成預設分類嗎？你新增和修改過的分類都會被清除。", "确定要恢复默认分类吗？你新增和修改过的分类都会被清除。", "既定のカテゴリに戻しますか？追加・編集したカテゴリは消去されます。", "기본 카테고리로 복원할까요? 추가하거나 수정한 카테고리는 삭제됩니다."),
    "resetDone": ("Default categories restored", "已還原預設分類", "已恢复默认分类", "既定のカテゴリに戻しました", "기본 카테고리로 복원했습니다"),
    "resetFailed": ("Couldn't restore", "還原失敗", "恢复失败", "復元できませんでした", "복원하지 못했습니다"),
    "savedSummary": ("Saved $1 categories and $2 channel rules. Open YouTube tabs apply them right away.", "已儲存 $1 個分類和 $2 個頻道規則，開啟中的 YouTube 分頁會立即套用。", "已保存 $1 个分类和 $2 个频道规则，打开的 YouTube 标签页会立即应用。", "カテゴリ $1 件とチャンネルルール $2 件を保存しました。開いている YouTube タブにすぐ適用されます。", "카테고리 $1개와 채널 규칙 $2개를 저장했습니다. 열려 있는 YouTube 탭에 바로 적용됩니다."),
    "errQuota": ("Categories exceed Chrome's sync storage limit. Remove some keywords or categories.", "分類資料超過 Chrome 同步容量上限，請減少關鍵字或分類數量。", "分类数据超过 Chrome 同步容量上限，请减少关键词或分类数量。", "カテゴリのデータが Chrome の同期容量の上限を超えています。キーワードやカテゴリを減らしてください。", "카테고리 데이터가 Chrome 동기화 용량 한도를 초과했습니다. 키워드나 카테고리를 줄이세요."),
    "errSave": ("Couldn't save", "儲存失敗", "保存失败", "保存できませんでした", "저장하지 못했습니다"),
    "errLoadSettings": ("Couldn't load settings", "無法載入設定", "无法加载设置", "設定を読み込めませんでした", "설정을 불러오지 못했습니다"),
}


def to_chrome_message(text):
    """Chrome wants named placeholders; expand $1 into $arg1$ plus its definition."""
    numbers = sorted(set(re.findall(r"\$(\d)", text)))
    entry = {"message": re.sub(r"\$(\d)", r"$arg\1$", text)}
    if numbers:
        entry["placeholders"] = {f"arg{n}": {"content": f"${n}"} for n in numbers}
    return entry


def main():
    assert all(len(row) == len(LOCALES) for row in MESSAGES.values())
    for key, row in MESSAGES.items():
        args = {tuple(sorted(set(re.findall(r"\$(\d)", text)))) for text in row}
        assert len(args) == 1, f"{key}: languages disagree on substitutions"
    for index, locale in enumerate(LOCALES):
        name, description = MESSAGES["extName"][index], MESSAGES["extDescription"][index]
        assert len(name) <= 75, (locale, len(name))
        assert len(description) <= 132, (locale, len(description))
        folder = ROOT / "extension" / "_locales" / locale
        folder.mkdir(parents=True, exist_ok=True)
        messages = {key: to_chrome_message(row[index]) for key, row in MESSAGES.items()}
        if locale == "en":
            # The pages' CJK-first fonts draw curly quotes full width
            for entry in messages.values():
                entry["message"] = entry["message"].replace("“", '"').replace("”", '"')
        (folder / "messages.json").write_text(
            json.dumps(messages, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {len(MESSAGES)} messages for {', '.join(LOCALES)}")


if __name__ == "__main__":
    main()
