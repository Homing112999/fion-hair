// 網站資料：改呢度就得，唔使掂其他檔案

export const SHOP = {
  name: 'Fion 髮型工作室',
  salon: '太子 Goody Salon · 星級髮型師 Fion',
  services: '假髮造型 · 髮型改造 · 形象指導',
  whatsapp: '85262022438', // 香港號碼要加 852（留空預約掣會隱藏）
  instagram: 'fionchan_hair',
  address: '',
};

// 大熱髮色：hex 只係網站預覽用嘅參考色，唔係染膏配方
// lift = 由幾多度底色開始先做到（3 = 原生黑髮都得，6 / 9 = 要褪色或漂）
export const COLOURS = [
  { id: 'mint-beige', name: '薄荷米棕', hex: '#8C7B66', lift: 6, note: '帶少少青嘅米棕 壓黃顯白' },
  { id: 'milk-tea', name: '奶茶色', hex: '#A9876A', lift: 6, note: '淺暖啡 好溫柔' },
  { id: 'black-tea', name: '黑茶色', hex: '#3B2A22', lift: 3, note: '深啡近黑 返工都得' },
  { id: 'ash-brown', name: '霧感灰棕', hex: '#6E625A', lift: 6, note: '而家最流行嘅霧感色 冇黃氣' },
  { id: 'eggplant', name: '茄子紫灰', hex: '#4E3F4C', lift: 3, note: '深紫帶灰 低調有型' },
  { id: 'grape', name: '葡萄紫灰', hex: '#6A5470', lift: 6, note: '淺啲嘅紫灰 光底下見紫' },
  { id: 'cinnamon', name: '肉桂橙', hex: '#A0603A', lift: 6, note: '暖橙啡 好顯氣色' },
  { id: 'caramel', name: '焦糖棕', hex: '#9A5B2E', lift: 6, note: '暖金啡 有光澤感' },
  { id: 'linen', name: '亞麻色', hex: '#B8A27E', lift: 9, note: '淺亞麻 要漂' },
  { id: 'blue-black', name: '藍黑色', hex: '#1C2230', lift: 3, note: '黑底透藍光' },
];

export const BASES = [
  { level: 3, name: '3度', note: '原生黑髮 冇染過' },
  { level: 6, name: '6度', note: '染過啡色 / 褪咗色' },
  { level: 9, name: '9度', note: '漂過 / 好淺' },
];

// 面型（由舊網站搬過嚟）
export const FACE_SHAPES = {
  round: { name: '圓形臉', desc: '臉頰係最闊嘅位置 長闊比例接近 線條偏圓潤' },
  square: { name: '方形臉', desc: '額頭、顴骨、下顎闊度接近 下顎線條較方正' },
  long: { name: '長形臉', desc: '臉長明顯大於臉闊 額頭較高' },
  oval: { name: '鵝蛋臉', desc: '額頭比下顎稍闊 線條圓潤自然收窄 比例最勻稱' },
  heart: { name: '心形臉', desc: '額頭同顴骨較闊 下巴較尖細' },
};

export const TEXTURES = {
  straight: { name: '順直', desc: '頭髮天生順滑 少毛燥少捲度' },
  wavy: { name: '自然微曲', desc: '髮尾或全長有少少自然曲度' },
  curly: { name: '捲曲', desc: '天生捲髮 毛燥感較明顯' },
};

export const MAINTENANCE = {
  low: { name: '低打理', desc: '出街唔想吹唔想整 快靚正就得' },
  medium: { name: '中等打理', desc: '願意花少少時間吹整 唔想太複雜' },
  high: { name: '願意花心機打理', desc: '鐘意造型 願意花時間打理同用產品' },
};

// 熱門髮型（由舊網站搬過嚟）
// bestFor = 啱邊啲面型 bestTexture = 啱邊啲髮質 genPrompt = 將來 AI 效果圖用
export const STYLES = [
  {
    "id": "curtain-lob",
    "name": "法式空氣瀏海Lob",
    "tagline": "顯瘦顯嫩,日常百搭",
    "description": "齊肩到鎖骨嘅長度,配中分空氣瀏海,修飾額頭比例,適合想襯托五官又唔想太誇張嘅客人。",
    "bestFor": [
      "round",
      "square",
      "heart",
      "long"
    ],
    "bestTexture": [
      "straight",
      "wavy"
    ],
    "maintenance": "low",
    "genPrompt": "a chic French-style lob (long bob) haircut reaching the collarbone with soft center-parted curtain bangs, natural face-framing layers, glossy healthy finish"
  },
  {
    "id": "wolf-cut",
    "name": "狼系層次Wolf Cut",
    "tagline": "個性率性,層次感強,韓系大熱",
    "description": "頭頂蓬鬆、尾段外翹嘅多層次剪裁,內短外長,帶少少凌亂感,適合想突出個性、經常出鏡拍片嘅客人,中長至中短髮都啱試。",
    "bestFor": [
      "oval",
      "square",
      "long"
    ],
    "bestTexture": [
      "wavy",
      "curly"
    ],
    "maintenance": "medium",
    "genPrompt": "an edgy layered wolf cut hairstyle with volume at the crown, choppy face-framing layers, slightly tousled flipped-out ends, textured modern finish"
  },
  {
    "id": "curly-long",
    "name": "大波浪長捲髮",
    "tagline": "氣質女神感",
    "description": "全長自然大波浪捲度,增加髮量感同動感,適合想營造溫柔氣場嘅場合同活動內容。",
    "bestFor": [
      "long",
      "oval",
      "heart",
      "square"
    ],
    "bestTexture": [
      "wavy",
      "curly"
    ],
    "maintenance": "high",
    "genPrompt": "long voluminous soft large curls / beach waves throughout the hair, glamorous elegant texture, natural shine"
  },
  {
    "id": "blunt-bob",
    "name": "利落齊剪Bob",
    "tagline": "俐落專業,顯氣場",
    "description": "下巴到耳下長度嘅一刀切Bob,線條乾淨俐落,最適合鵝蛋臉、心形臉呢類本身輪廓夠柔和嘅客人;圓臉直接剪齊蔭反而會顯闊,想試嘅圓臉客建議加少少層次先。",
    "bestFor": [
      "oval",
      "heart",
      "long"
    ],
    "bestTexture": [
      "straight"
    ],
    "maintenance": "medium",
    "genPrompt": "a sharp blunt-cut bob haircut just below the chin, clean straight-across ends, sleek polished finish, no bangs"
  },
  {
    "id": "highlight-money",
    "name": "挑染漸層Money Piece",
    "tagline": "唔改長度,先試色",
    "description": "保留原有長度同剪裁,只喺髮尾/瀏海位加入漸層挑染,係想「先試色再決定剪唔剪」嘅客人首選,任何臉型髮質都啱試。",
    "bestFor": [
      "round",
      "square",
      "long",
      "oval",
      "heart"
    ],
    "bestTexture": [
      "straight",
      "wavy",
      "curly"
    ],
    "maintenance": "medium",
    "genPrompt": "the same hairstyle and length but with a face-framing money-piece balayage highlight, warm caramel-to-blonde gradient color melt, natural dimensional color"
  },
  {
    "id": "slick-low-bun",
    "name": "復古油頭低髻",
    "tagline": "極簡高級感",
    "description": "全頭梳理向後嘅Slick Back低髻,線條乾淨,適合正式活動或者想突顯五官輪廓嘅場合,圓臉、方臉客人紮起嚟仲會有修容效果。",
    "bestFor": [
      "round",
      "square",
      "oval",
      "heart"
    ],
    "bestTexture": [
      "straight",
      "wavy"
    ],
    "maintenance": "low",
    "genPrompt": "hair slicked back smoothly into a sleek low bun, polished vintage glamour finish, clean hairline, no flyaways"
  },
  {
    "id": "butterfly-cut",
    "name": "蝴蝶剪Butterfly Cut",
    "tagline": "2026年最大熱層次剪法",
    "description": "臉部周圍集中短層次,往下逐漸留長至肩下,形似蝴蝶展翅,輕盈飄逸又唔會死實實一片。中長髮想加層次又唔想剪短嘅客人首選。",
    "bestFor": [
      "round",
      "oval",
      "square",
      "heart"
    ],
    "bestTexture": [
      "wavy",
      "straight"
    ],
    "maintenance": "medium",
    "genPrompt": "a butterfly haircut with dramatic face-framing short layers at the crown that gradually lengthen towards longer strands past the shoulders, airy voluminous layered movement, soft blowout finish"
  },
  {
    "id": "bixie-cut",
    "name": "碧克茜短髮Bixie Cut",
    "tagline": "Bob+Pixie混合,型格減齡",
    "description": "介乎短鮑伯同精靈短髮之間嘅混合剪法,前短後翹,線條銳利有個性,適合想大膽轉短、又鍾意低打理嘅客人。",
    "bestFor": [
      "oval",
      "heart",
      "round"
    ],
    "bestTexture": [
      "straight",
      "wavy"
    ],
    "maintenance": "low",
    "genPrompt": "a bixie haircut, a seamless fusion of a short bob and a pixie cut, short textured layers, slightly tousled crown with soft wispy ends framing the face, edgy modern finish"
  },
  {
    "id": "hush-cut",
    "name": "微層次狼尾Hush Cut",
    "tagline": "韓國近期最多人剪嘅款",
    "description": "喺狼尾剪嘅基礎上加輕盈側瀏海,層次更貼服,睇落似「本身把頭髮就係咁靚」,唔使點打理都自然有型,中短至中長髮啱用。",
    "bestFor": [
      "round",
      "oval",
      "long"
    ],
    "bestTexture": [
      "wavy",
      "straight"
    ],
    "maintenance": "low",
    "genPrompt": "a Korean hush cut hairstyle, soft layered medium-short length with light side-swept bangs, effortless natural-looking layers, subtle volume, understated everyday finish"
  },
  {
    "id": "hime-cut",
    "name": "公主切Hime Cut",
    "tagline": "日系公主感,氣質滿分",
    "description": "齊整厚瀏海配兩側及肩直落側絲,後面保留長髮,線條分明有辨識度,額頭較高、臉型較長嘅客人特別適合,可以修飾臉部比例。",
    "bestFor": [
      "long",
      "oval"
    ],
    "bestTexture": [
      "straight"
    ],
    "maintenance": "medium",
    "genPrompt": "a Japanese hime cut (princess cut) hairstyle, a blunt straight-across fringe paired with straight face-framing side locks reaching the shoulders, long sleek straight hair at the back, glossy polished finish"
  },
  {
    "id": "c-curl-perm",
    "name": "C字燙C-Curl Perm",
    "tagline": "髮尾自然內彎,顯瘦顯溫柔",
    "description": "只喺髮尾位置做內彎或外翹嘅C字曲度,唔使天天用電捲棒都有蓬鬆感,任何長度都可以做,係想由直髮轉做有少少弧度嘅客人入門之選。",
    "bestFor": [
      "round",
      "square",
      "long",
      "oval"
    ],
    "bestTexture": [
      "straight"
    ],
    "maintenance": "medium",
    "genPrompt": "hair with a subtle C-curl perm, ends curled gently inward towards the face, smooth roots with soft bounce only at the tips, natural rounded silhouette, glossy finish"
  },
  {
    "id": "bohemian-perm",
    "name": "羊毛卷波希米亞燙Bohemian Perm",
    "tagline": "慵懶隨性,自然唔死板",
    "description": "全頭鬆散海浪卷,捲度比一般電髮鬆身自然,似「一覺瞓醒就係咁」嘅感覺,幾日唔打理都仲有型,啱想慳返吹頭時間嘅客人。",
    "bestFor": [
      "oval",
      "square",
      "heart",
      "long"
    ],
    "bestTexture": [
      "wavy",
      "curly"
    ],
    "maintenance": "medium",
    "genPrompt": "a bohemian perm hairstyle, loose relaxed beachy waves throughout the hair, natural undone wavy texture as if air-dried, soft volume, low-effort tousled finish"
  },
  {
    "id": "jellyfish-lob",
    "name": "水母鎖骨剪Jellyfish Lob",
    "tagline": "顯瘦包面,近年香港沙龍大熱",
    "description": "內層剪短至肩上、外層留至鎖骨,一層一層由內向外遞增長度,弧度剛好包住下顎線條,修飾臉型效果好,適合想剪短但又怕唔夾臉型嘅客人。",
    "bestFor": [
      "round",
      "square",
      "heart"
    ],
    "bestTexture": [
      "straight",
      "wavy"
    ],
    "maintenance": "medium",
    "genPrompt": "a jellyfish lob haircut, inner layers cut shorter to shoulder length with longer outer layers reaching the collarbone, rounded jaw-hugging silhouette, voluminous layered structure, sleek glossy finish"
  },
  {
    "id": "elongated-pixie",
    "name": "長瀏海精靈短髮Elongated Pixie",
    "tagline": "夠晒大膽,型格又易打理",
    "description": "2026版精靈短髮,唔再係傳統貼頭皮短剪,而係後頸留長少少、瀏海斜掃過額,睇落更柔和唔會太硬淨,啱想剪短又怕太中性嘅客人。",
    "bestFor": [
      "oval",
      "heart",
      "long"
    ],
    "bestTexture": [
      "straight",
      "wavy"
    ],
    "maintenance": "low",
    "genPrompt": "a modern elongated pixie cut, longer nape and side pieces than a classic pixie, soft side-swept fringe sweeping across the forehead, textured feminine finish, effortlessly stylish"
  }
];
