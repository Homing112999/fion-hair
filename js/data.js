// 網站資料：改呢度就得，唔使掂其他檔案

export const SHOP = {
  name: 'Fion 髮型工作室',
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

export const FACE_SHAPES = {
  oval: {
    name: '鵝蛋面',
    intro: '比例最平均 乜髮型都易襯',
    styles: [
      { name: '鎖骨長髮 + 大波浪', why: '保留臉型優勢 加多啲女人味' },
      { name: '一刀切 Bob', why: '利落有型 顯精神' },
      { name: '韓式空氣瀏海', why: '減齡 又唔會遮晒個面' },
    ],
  },
  round: {
    name: '圓面',
    intro: '面寬同面長差唔多 想拉長視覺',
    styles: [
      { name: '過肩層次長髮', why: '兩邊垂直線條拉長面型' },
      { name: '八字瀏海', why: '遮兩側 面即刻細咗' },
      { name: '頭頂蓬鬆嘅 Lob', why: '加高頭頂 唔好兩邊脹' },
    ],
  },
  square: {
    name: '方面',
    intro: '腮骨明顯 想柔化線條',
    styles: [
      { name: '長捲髮 C 字彎', why: '弧線包住腮骨 柔和好多' },
      { name: '側分長瀏海', why: '打斜線條削弱方角' },
      { name: '下巴以下嘅層次短髮', why: '髮尾避開腮骨位置' },
    ],
  },
  long: {
    name: '長面',
    intro: '面長過面寬好多 想加闊減長',
    styles: [
      { name: '齊瀏海 / 厚瀏海', why: '直接縮短額頭位' },
      { name: '下巴長度 Bob', why: '橫向份量令面型平衡' },
      { name: '兩側蓬鬆嘅中長捲髮', why: '加闊兩邊 唔好太貼' },
    ],
  },
  heart: {
    name: '心形面 / 瓜子面',
    intro: '額頭闊 下巴尖 想平衡上下',
    styles: [
      { name: '下半部有份量嘅捲髮', why: '補返下巴位嘅闊度' },
      { name: '中長 Lob 外翻', why: '髮尾外翻平衡尖下巴' },
      { name: '輕薄斜瀏海', why: '收窄額頭' },
    ],
  },
};
