export type Lang = "en" | "th";

// All translatable strings for the Learn page
const translations: Record<string, Record<Lang, string>> = {
  // Header
  pageTitle: {
    en: "How to Read Charts & Trade with Probability",
    th: "วิธีอ่านกราฟและเทรดด้วยความน่าจะเป็น",
  },
  pageSubtitle: {
    en: "Master candlestick charts, market structure, risk management, and the trader mindset. Each section builds on the last — start from the top.",
    th: "เรียนรู้กราฟแท่งเทียน โครงสร้างตลาด การจัดการความเสี่ยง และทัศนคติของเทรดเดอร์ แต่ละบทต่อยอดจากบทก่อนหน้า — เริ่มจากด้านบน",
  },

  // Section titles
  marketMechanics: { en: "Market Mechanics", th: "กลไกตลาด" },
  definitionOfTrading: { en: "Definition of Trading", th: "ความหมายของการเทรด" },
  chartReadingLayers: { en: "Chart Reading Layers", th: "ชั้นของการอ่านกราฟ" },
  coreMechanics: { en: "Core Mechanics", th: "กลไกหลัก" },
  smartMoneyConcepts: { en: "Smart Money Concepts", th: "แนวคิด Smart Money" },
  traderMindset: { en: "Trader Mindset", th: "ทัศนคติเทรดเดอร์" },
  psychologicalTraps: { en: "Psychological Traps", th: "กับดักทางจิตวิทยา" },
  tradingMath: { en: "Trading Math", th: "คณิตศาสตร์การเทรด" },
  processAndImprovement: { en: "Process and Improvement", th: "กระบวนการและการพัฒนา" },
  multiTimeframeAnalysis: { en: "Multi-Timeframe Analysis", th: "การวิเคราะห์หลายไทม์เฟรม" },
  growthAndScaling: { en: "Growth and Scaling", th: "การเติบโตและขยายพอร์ต" },

  // Badges
  foundation: { en: "Foundation", th: "พื้นฐาน" },
  core: { en: "Core", th: "หลัก" },
  essential: { en: "Essential", th: "สำคัญ" },
  critical: { en: "Critical", th: "สำคัญมาก" },
  advanced: { en: "Advanced", th: "ขั้นสูง" },
  deepDive: { en: "Deep Dive", th: "เจาะลึก" },

  // Market Mechanics
  mm_intro: {
    en: "Price moves because of an imbalance between buyers and sellers. Every candle tells a story about who won that battle during that time period.",
    th: "ราคาเคลื่อนที่เพราะความไม่สมดุลระหว่างผู้ซื้อและผู้ขาย ทุกแท่งเทียนเล่าเรื่องราวว่าใครชนะในช่วงเวลานั้น",
  },
  howPriceMoves: { en: "How Price Moves", th: "ราคาเคลื่อนที่อย่างไร" },
  mm_buyers: { en: "More buyers than sellers = price goes up.", th: "ผู้ซื้อมากกว่าผู้ขาย = ราคาขึ้น" },
  mm_sellers: { en: "More sellers than buyers = price goes down.", th: "ผู้ขายมากกว่าผู้ซื้อ = ราคาลง" },
  mm_equal: { en: "Equal pressure = consolidation (sideways).", th: "แรงกดดันเท่ากัน = แกว่งตัว (ไซด์เวย์)" },
  orderFlow: { en: "Order Flow", th: "กระแสคำสั่ง" },
  mm_market_orders: {
    en: "Market orders move price — they hit existing bids/asks.",
    th: "คำสั่ง Market Order เคลื่อนราคา — มันกระทบ bid/ask ที่มีอยู่",
  },
  mm_limit_orders: {
    en: "Limit orders create support/resistance — they sit waiting.",
    th: "คำสั่ง Limit Order สร้างแนวรับ/แนวต้าน — มันรอนิ่งๆ",
  },
  mm_volume: {
    en: "Volume confirms conviction — high volume = real move.",
    th: "ปริมาณการซื้อขายยืนยันความมั่นใจ — ปริมาณมาก = การเคลื่อนไหวจริง",
  },
  bidAskSpread: { en: "Bid-Ask Spread", th: "สเปรด Bid-Ask" },
  mm_spread: {
    en: "The spread is the cost of doing business. Liquid stocks (SPY, AAPL) have tiny spreads. Low-volume penny stocks have wide spreads — you lose money the instant you enter.",
    th: "สเปรดคือต้นทุนของการเทรด หุ้นที่มีสภาพคล่องสูง (SPY, AAPL) มีสเปรดเล็ก หุ้นเพนนี่ที่ปริมาณน้อยมีสเปรดกว้าง — คุณเสียเงินทันทีที่เข้าเทรด",
  },

  // Definition of Trading
  tradingNotGambling: { en: "Trading is NOT Gambling", th: "การเทรดไม่ใช่การพนัน" },
  dt_probability: {
    en: "Trading is a probability game. You don't need to be right every time. You need a system where your winners pay more than your losers cost.",
    th: "การเทรดคือเกมความน่าจะเป็น คุณไม่จำเป็นต้องถูกทุกครั้ง คุณต้องมีระบบที่การชนะจ่ายมากกว่าต้นทุนของการแพ้",
  },
  yourJob: { en: "Your Job", th: "งานของคุณ" },
  identifyOutcomes: { en: "Identify probable outcomes", th: "ระบุผลลัพธ์ที่น่าจะเป็น" },
  yourEdge: { en: "Your Edge", th: "ข้อได้เปรียบของคุณ" },
  useProbability: { en: "Use probability & controlled risk", th: "ใช้ความน่าจะเป็นและควบคุมความเสี่ยง" },
  yourMeasure: { en: "Your Measure", th: "ตัววัดของคุณ" },
  evaluateExpectancy: { en: "Evaluate expectancy & stats", th: "ประเมิน Expectancy และสถิติ" },
  expectancyFormula: { en: "Expectancy Formula", th: "สูตร Expectancy" },
  dt_formula_desc: {
    en: "If positive, your strategy makes money over time. If negative, you lose no matter how good it \"feels.\"",
    th: "ถ้าเป็นบวก กลยุทธ์ของคุณทำเงินได้ในระยะยาว ถ้าเป็นลบ คุณจะขาดทุนไม่ว่าจะ \"รู้สึก\" ดีแค่ไหน",
  },
  dt_example: {
    en: "Example: 30% win rate, avg win +3.6R, avg loss -1R",
    th: "ตัวอย่าง: อัตราชนะ 30%, ชนะเฉลี่ย +3.6R, แพ้เฉลี่ย -1R",
  },

  // Chart Reading Layers
  crl_intro: {
    en: "Reading a chart has layers. Master each one before combining them.",
    th: "การอ่านกราฟมีหลายชั้น เรียนรู้แต่ละชั้นให้เชี่ยวชาญก่อนนำมารวมกัน",
  },
  anatomy: { en: "Anatomy", th: "โครงสร้าง" },
  patterns: { en: "Patterns", th: "รูปแบบ" },
  wicks: { en: "Wicks", th: "ไส้เทียน" },
  body: { en: "Body", th: "ตัวเทียน" },
  volume: { en: "Volume", th: "ปริมาณ" },
  context: { en: "Context", th: "บริบท" },
  candlestickAnatomy: { en: "Candlestick Anatomy", th: "โครงสร้างแท่งเทียน" },

  bullishCandle: { en: "Bullish (Green) Candle", th: "แท่งเทียนขาขึ้น (สีเขียว)" },
  bull_close_gt_open: { en: "Close > Open — buyers won this period.", th: "ปิด > เปิด — ผู้ซื้อชนะในช่วงนี้" },
  bull_body: { en: "The body shows the range buyers controlled.", th: "ตัวเทียนแสดงช่วงที่ผู้ซื้อควบคุม" },
  bull_upper: { en: "Upper wick = sellers pushed back briefly.", th: "ไส้เทียนบน = ผู้ขายผลักกลับชั่วคราว" },
  bull_lower: { en: "Lower wick = buyers recovered from a dip.", th: "ไส้เทียนล่าง = ผู้ซื้อฟื้นตัวจากการดิ่ง" },

  bearishCandle: { en: "Bearish (Red) Candle", th: "แท่งเทียนขาลง (สีแดง)" },
  bear_close_lt_open: { en: "Close < Open — sellers won this period.", th: "ปิด < เปิด — ผู้ขายชนะในช่วงนี้" },
  bear_body: { en: "The body shows the range sellers controlled.", th: "ตัวเทียนแสดงช่วงที่ผู้ขายควบคุม" },
  bear_lower: { en: "Lower wick = buyers tried to fight back.", th: "ไส้เทียนล่าง = ผู้ซื้อพยายามสู้กลับ" },
  bear_upper: { en: "Upper wick = sellers rejected higher prices.", th: "ไส้เทียนบน = ผู้ขายปฏิเสธราคาที่สูงกว่า" },

  keyPatterns: { en: "Key Candlestick Patterns", th: "รูปแบบแท่งเทียนสำคัญ" },
  bullishReversal: { en: "Bullish Reversal", th: "กลับตัวขึ้น" },
  bearishReversal: { en: "Bearish Reversal", th: "กลับตัวลง" },
  strongReversal: { en: "Strong Reversal", th: "กลับตัวแรง" },
  indecision: { en: "Indecision", th: "ลังเล" },
  continuation: { en: "Continuation", th: "ต่อเนื่อง" },
  reversalAtTop: { en: "Reversal at Top", th: "กลับตัวที่ยอด" },

  readingWicks: { en: "Reading Wicks (Shadows)", th: "การอ่านไส้เทียน (เงา)" },
  wicksTitle: { en: "Wicks Tell the Rejected Story", th: "ไส้เทียนบอกเรื่องราวการถูกปฏิเสธ" },
  wicks_upper: {
    en: "Long upper wick = sellers rejected that high. Price was pushed up but couldn't hold.",
    th: "ไส้เทียนบนยาว = ผู้ขายปฏิเสธราคาสูง ราคาถูกดันขึ้นแต่ไม่สามารถรักษาไว้ได้",
  },
  wicks_lower: {
    en: "Long lower wick = buyers rejected that low. Price dipped but bounced back hard.",
    th: "ไส้เทียนล่างยาว = ผู้ซื้อปฏิเสธราคาต่ำ ราคาดิ่งแต่เด้งกลับอย่างแรง",
  },
  wicks_none: {
    en: "No wick (Marubozu) = total domination by one side.",
    th: "ไม่มีไส้เทียน (Marubozu) = ฝ่ายหนึ่งครอบงำทั้งหมด",
  },
  wickBodyRatio: { en: "Wick-to-Body Ratio", th: "อัตราส่วนไส้เทียนต่อตัวเทียน" },
  wicks_ratio: {
    en: "If the wick is 2x+ the body = strong rejection. The longer the wick relative to the body, the more violent the rejection was.",
    th: "ถ้าไส้เทียนยาวกว่าตัวเทียน 2 เท่า = การปฏิเสธที่แรง ยิ่งไส้เทียนยาวเมื่อเทียบกับตัวเทียน การปฏิเสธยิ่งรุนแรง",
  },
  wicks_pinbar: {
    en: "Pin bars (long wick, tiny body) at support/resistance are high-probability setups.",
    th: "Pin Bar (ไส้เทียนยาว ตัวเทียนเล็ก) ที่แนวรับ/แนวต้าน คือเซ็ตอัพที่มีความน่าจะเป็นสูง",
  },

  readingBody: { en: "Reading the Body", th: "การอ่านตัวเทียน" },
  bodyConviction: { en: "Body Size = Conviction", th: "ขนาดตัวเทียน = ความมั่นใจ" },
  body_large: {
    en: "Large body = strong conviction. Buyers (green) or sellers (red) are in full control.",
    th: "ตัวเทียนใหญ่ = ความมั่นใจสูง ผู้ซื้อ (เขียว) หรือผู้ขาย (แดง) ควบคุมอย่างเต็มที่",
  },
  body_small: {
    en: "Small body = indecision. Neither side has conviction.",
    th: "ตัวเทียนเล็ก = ลังเล ไม่มีฝ่ายใดมั่นใจ",
  },
  body_doji: {
    en: "No body (Doji) = complete balance. Often a turning point.",
    th: "ไม่มีตัวเทียน (Doji) = สมดุลสมบูรณ์ มักเป็นจุดเปลี่ยน",
  },
  shrinkingBodies: { en: "Shrinking Bodies", th: "ตัวเทียนเล็กลงเรื่อยๆ" },
  body_shrinking: {
    en: "When candle bodies get progressively smaller in a trend, the trend is losing steam. Watch for reversal signals.",
    th: "เมื่อตัวเทียนเล็กลงเรื่อยๆ ในแนวโน้ม แนวโน้มกำลังอ่อนแรง จับตาสัญญาณกลับตัว",
  },

  volumeConfirmation: { en: "Volume Confirmation", th: "การยืนยันด้วยปริมาณ" },
  volumeValidates: { en: "Volume Validates Price", th: "ปริมาณยืนยันราคา" },
  vol_high_green: {
    en: "High volume + big green candle = real buying. Institutions are participating.",
    th: "ปริมาณมาก + แท่งเทียนเขียวใหญ่ = การซื้อจริง สถาบันกำลังเข้าร่วม",
  },
  vol_high_red: {
    en: "High volume + big red candle = real selling. Smart money is exiting.",
    th: "ปริมาณมาก + แท่งเทียนแดงใหญ่ = การขายจริง Smart Money กำลังออก",
  },
  vol_low: {
    en: "Low volume move = unreliable. Could be retail noise.",
    th: "การเคลื่อนไหวปริมาณน้อย = ไม่น่าเชื่อถือ อาจเป็นเสียงรบกวนจากรายย่อย",
  },
  volumeDivergence: { en: "Volume Divergence", th: "Volume Divergence" },
  vol_divergence: {
    en: "Price making new highs but volume declining = bearish divergence. The move is running out of fuel. Be cautious with new longs.",
    th: "ราคาทำจุดสูงสุดใหม่แต่ปริมาณลดลง = Bearish Divergence การเคลื่อนไหวกำลังหมดแรง ระวังการเปิดสถานะ Long ใหม่",
  },

  contextIsKing: { en: "Context is King", th: "บริบทคือราชา" },
  sameCandle: { en: "Same Candle, Different Meaning", th: "แท่งเทียนเดียวกัน ความหมายต่างกัน" },
  ctx_hammer_support: {
    en: "A hammer at support = bullish reversal signal.",
    th: "Hammer ที่แนวรับ = สัญญาณกลับตัวขึ้น",
  },
  ctx_hammer_middle: {
    en: "A hammer in the middle of a range = noise, ignore it.",
    th: "Hammer กลางกรอบราคา = เสียงรบกวน ไม่ต้องสนใจ",
  },
  ctx_hammer_resistance: {
    en: "A hammer at resistance after a massive run = probably just a pause, not bullish.",
    th: "Hammer ที่แนวต้านหลังขึ้นมาเยอะ = น่าจะแค่หยุดพัก ไม่ใช่สัญญาณขึ้น",
  },
  ctx_where: {
    en: "Always ask: WHERE on the chart is this pattern forming?",
    th: "ถามเสมอว่า: รูปแบบนี้เกิดที่ตรงไหนบนกราฟ?",
  },

  // Core Mechanics
  supportAndResistance: { en: "Support & Resistance", th: "แนวรับและแนวต้าน" },
  marketStructure: { en: "Market Structure", th: "โครงสร้างตลาด" },
  trendVsRange: { en: "Trend vs Range", th: "แนวโน้มกับกรอบราคา" },
  multiTimeframe: { en: "Multi-Timeframe", th: "หลายไทม์เฟรม" },

  support: { en: "Support", th: "แนวรับ" },
  support_desc: {
    en: "A price level where buyers step in and prevent further decline.",
    th: "ระดับราคาที่ผู้ซื้อเข้ามาและป้องกันไม่ให้ราคาลงต่อ",
  },
  support_bounce: {
    en: "The more times price bounces off support, the stronger it is.",
    th: "ยิ่งราคาเด้งจากแนวรับบ่อยเท่าไหร่ แนวรับยิ่งแข็งแกร่ง",
  },
  support_break: {
    en: "When support breaks, it often becomes resistance (role reversal).",
    th: "เมื่อแนวรับถูกทะลุ มักกลายเป็นแนวต้าน (สลับบทบาท)",
  },
  resistance: { en: "Resistance", th: "แนวต้าน" },
  resistance_desc: {
    en: "A price level where sellers step in and prevent further advance.",
    th: "ระดับราคาที่ผู้ขายเข้ามาและป้องกันไม่ให้ราคาขึ้นต่อ",
  },
  resistance_ceiling: {
    en: "Think of it as a ceiling — price keeps getting rejected here.",
    th: "คิดซะว่าเป็นเพดาน — ราคาถูกปฏิเสธซ้ำๆ ที่นี่",
  },
  resistance_break: {
    en: "When resistance breaks, it often becomes support.",
    th: "เมื่อแนวต้านถูกทะลุ มักกลายเป็นแนวรับ",
  },
  keyLevels: { en: "Key Levels to Watch", th: "ระดับสำคัญที่ต้องจับตา" },
  keyLevels_desc: {
    en: "Previous day high/low, weekly high/low, round numbers ($100, $150, $200), gap fills, and VWAP are all key S/R levels.",
    th: "จุดสูง/ต่ำของวันก่อน, สัปดาห์ก่อน, ตัวเลขกลม ($100, $150, $200), การเติมช่องว่าง และ VWAP ล้วนเป็นระดับแนวรับ/แนวต้านสำคัญ",
  },

  // Trader Mindset
  thinkProbabilities: { en: "Think in Probabilities, Not Certainties", th: "คิดเป็นความน่าจะเป็น ไม่ใช่ความแน่นอน" },
  tm_intro: {
    en: "No setup is 100%. You will have losing trades. The goal is to win MORE than you lose in dollar terms, not in trade count.",
    th: "ไม่มีเซ็ตอัพไหน 100% คุณจะมีเทรดที่แพ้ เป้าหมายคือชนะมากกว่าแพ้ในแง่เงิน ไม่ใช่จำนวนเทรด",
  },
  tm_winrate: {
    en: "A strategy with 30% win rate can be extremely profitable if your winners are 3-4x your losers.",
    th: "กลยุทธ์ที่มีอัตราชนะ 30% สามารถทำกำไรได้มากถ้าการชนะของคุณใหญ่กว่าการแพ้ 3-4 เท่า",
  },
  processOverOutcome: { en: "Process Over Outcome", th: "กระบวนการเหนือผลลัพธ์" },
  tm_good_trade: { en: "A good trade = followed your rules, win or lose.", th: "เทรดที่ดี = ทำตามกฎของคุณ ไม่ว่าจะชนะหรือแพ้" },
  tm_bad_trade: { en: "A bad trade = broke your rules, even if it won.", th: "เทรดที่ไม่ดี = ฝ่าฝืนกฎของคุณ แม้จะชนะก็ตาม" },
  tm_judge: { en: "Judge yourself on process, not individual results.", th: "ตัดสินตัวเองจากกระบวนการ ไม่ใช่ผลลัพธ์แต่ละครั้ง" },
  detachFromMoney: { en: "Detach from Money", th: "แยกตัวจากเงิน" },
  tm_runits: {
    en: "Think in R-units, not dollars. \"I risked 1R and gained 2.5R.\"",
    th: "คิดเป็นหน่วย R ไม่ใช่เงิน \"ฉันเสี่ยง 1R และได้ 2.5R\"",
  },
  tm_detach: {
    en: "This removes emotional attachment to the dollar amount and lets you focus on execution.",
    th: "สิ่งนี้ลดความผูกพันทางอารมณ์กับจำนวนเงินและให้คุณโฟกัสกับการปฏิบัติ",
  },

  // Psychological Traps
  revengeTrading: { en: "Revenge Trading", th: "เทรดแก้แค้น" },
  pt_revenge: {
    en: "After a loss, the urge to \"make it back\" immediately. This leads to oversized positions and poor setups.",
    th: "หลังขาดทุน ความอยากจะ \"เอาคืน\" ทันที สิ่งนี้นำไปสู่การเปิดสถานะใหญ่เกินไปและเซ็ตอัพที่ไม่ดี",
  },
  pt_revenge_fix: {
    en: "Fix: Walk away after 2 consecutive losses. Come back tomorrow.",
    th: "แก้ไข: เลิกเทรดหลังแพ้ติดต่อกัน 2 ครั้ง กลับมาพรุ่งนี้",
  },
  fomo: { en: "FOMO (Fear of Missing Out)", th: "FOMO (กลัวพลาดโอกาส)" },
  pt_fomo: {
    en: "Chasing a move that already happened. You see green candles and jump in at the top.",
    th: "ไล่ตามการเคลื่อนไหวที่เกิดขึ้นแล้ว คุณเห็นแท่งเทียนเขียวและกระโดดเข้าที่ยอด",
  },
  pt_fomo_fix: {
    en: "Fix: If you missed it, you missed it. There will always be another setup.",
    th: "แก้ไข: ถ้าพลาดแล้ว ก็พลาดไป จะมีเซ็ตอัพอื่นเสมอ",
  },
  overtrading: { en: "Overtrading", th: "เทรดมากเกินไป" },
  pt_overtrading: {
    en: "Taking 20 trades when only 3 met your criteria. Boredom + screen time = bad trades.",
    th: "เทรด 20 ครั้งเมื่อมีแค่ 3 ครั้งที่ตรงเกณฑ์ เบื่อ + นั่งดูจอ = เทรดที่ไม่ดี",
  },
  pt_overtrading_fix: {
    en: "Fix: Set a max trade limit per day (e.g. 3 trades max).",
    th: "แก้ไข: กำหนดจำนวนเทรดสูงสุดต่อวัน (เช่น สูงสุด 3 เทรด)",
  },
  movingStopLoss: { en: "Moving Stop Losses", th: "ย้าย Stop Loss" },
  pt_moving_stop: {
    en: "Widening your stop \"just a little more\" hoping it turns around. It rarely does.",
    th: "ขยาย Stop \"อีกนิดเดียว\" หวังว่ามันจะกลับตัว ซึ่งมันไม่ค่อยเป็นแบบนั้น",
  },
  pt_moving_stop_fix: {
    en: "Fix: Set your stop BEFORE entry. Never move it further away.",
    th: "แก้ไข: ตั้ง Stop ก่อนเข้าเทรด อย่าย้ายมันออกไปไกลกว่าเดิม",
  },

  // Trading Math
  positionSizingFormula: { en: "Position Sizing Formula", th: "สูตรการกำหนดขนาดสถานะ" },
  tm_formula_example: {
    en: "Example: You want to risk $100. Entry = $153.52, Stop = $150.52",
    th: "ตัวอย่าง: คุณต้องการเสี่ยง $100 จุดเข้า = $153.52, Stop = $150.52",
  },
  tm_position_value: {
    en: "Position value: 33 x $153.52 = $5,066. But you only risk $100 (your 1R).",
    th: "มูลค่าสถานะ: 33 x $153.52 = $5,066 แต่คุณเสี่ยงแค่ $100 (1R ของคุณ)",
  },
  onePercentRule: { en: "The 1% Rule", th: "กฎ 1%" },
  tm_1pct: {
    en: "Never risk more than 1-2% of your total account on a single trade.",
    th: "อย่าเสี่ยงเกิน 1-2% ของบัญชีทั้งหมดในเทรดเดียว",
  },
  tm_1pct_example: {
    en: "$10,000 account = max $100-200 risk per trade.",
    th: "บัญชี $10,000 = ความเสี่ยงสูงสุด $100-200 ต่อเทรด",
  },
  tm_1pct_survival: {
    en: "This means you can lose 10 trades in a row and still have 80-90% of your capital.",
    th: "หมายความว่าคุณสามารถแพ้ติดต่อกัน 10 ครั้งและยังมีเงินทุน 80-90%",
  },
  riskRewardRatio: { en: "Risk-Reward Ratio", th: "อัตราส่วนความเสี่ยงต่อผลตอบแทน" },
  tm_rr: {
    en: "Always aim for at least 2:1 reward-to-risk.",
    th: "ตั้งเป้าอย่างน้อย 2:1 ผลตอบแทนต่อความเสี่ยง",
  },
  tm_rr_math: {
    en: "Risk $1 to make $2 minimum. This means you only need to win 34% of your trades to break even.",
    th: "เสี่ยง $1 เพื่อทำ $2 ขั้นต่ำ หมายความว่าคุณต้องชนะแค่ 34% ของเทรดเพื่อเสมอตัว",
  },
  unitOfRisk: { en: "Unit of Risk (R)", th: "หน่วยความเสี่ยง (R)" },
  tm_r_unit: {
    en: "1R = the amount you risk on a trade. All P&L is measured in R-multiples.",
    th: "1R = จำนวนเงินที่คุณเสี่ยงในแต่ละเทรด กำไร/ขาดทุนทั้งหมดวัดเป็นตัวคูณ R",
  },
  loss: { en: "Loss", th: "ขาดทุน" },
  win: { en: "Win", th: "กำไร" },
  hitStopLoss: { en: "Hit stop loss", th: "โดน Stop Loss" },
  hitTarget: { en: "Hit target", th: "ถึงเป้าหมาย" },

  // Process
  tradingJournal: { en: "Trading Journal", th: "บันทึกการเทรด" },
  proc_journal: {
    en: "Log every trade: entry, exit, R-multiple, screenshot of the setup, and your emotional state.",
    th: "บันทึกทุกเทรด: จุดเข้า, จุดออก, ตัวคูณ R, ภาพหน้าจอของเซ็ตอัพ และสภาพอารมณ์ของคุณ",
  },
  proc_review: {
    en: "Review weekly. Look for patterns in your behavior — when do you make your best/worst trades?",
    th: "ทบทวนทุกสัปดาห์ มองหารูปแบบในพฤติกรรมของคุณ — คุณเทรดดีที่สุด/แย่ที่สุดเมื่อไหร่?",
  },
  backtest: { en: "Backtest", th: "ทดสอบย้อนหลัง" },
  backtest_desc: {
    en: "Prove your edge with historical data. 100+ trades minimum.",
    th: "พิสูจน์ข้อได้เปรียบของคุณด้วยข้อมูลย้อนหลัง ขั้นต่ำ 100 เทรด",
  },
  paperTrade: { en: "Paper Trade", th: "เทรดจำลอง" },
  paperTrade_desc: {
    en: "Execute live with fake money. Practice mechanics and emotions.",
    th: "เทรดสดด้วยเงินจำลอง ฝึกกลไกและอารมณ์",
  },
  liveSmall: { en: "Live (Small)", th: "เทรดจริง (เล็ก)" },
  liveSmall_desc: {
    en: "Start with smallest position size. Scale up only after consistency.",
    th: "เริ่มด้วยขนาดสถานะเล็กที่สุด ขยายหลังจากสม่ำเสมอเท่านั้น",
  },
  keyMetrics: { en: "Key Metrics to Track", th: "ตัวชี้วัดสำคัญที่ต้องติดตาม" },

  // Growth
  whenToScaleUp: { en: "When to Scale Up", th: "เมื่อไหร่ควรขยายขนาด" },
  gs_consistency: {
    en: "Only increase position size after proving consistency for at least 3 months.",
    th: "เพิ่มขนาดสถานะหลังจากพิสูจน์ความสม่ำเสมอได้อย่างน้อย 3 เดือน",
  },
  gs_scale: {
    en: "Scale up by 25-50% max. Never double overnight.",
    th: "ขยายสูงสุด 25-50% อย่าเพิ่มเป็น 2 เท่าข้ามคืน",
  },
  gs_drawdown: {
    en: "If you hit your max drawdown limit, scale BACK DOWN and re-evaluate.",
    th: "ถ้าถึงขีดจำกัด Drawdown สูงสุด ลดขนาดกลับลงและประเมินใหม่",
  },
  addingToWinners: { en: "Adding to Winners", th: "เพิ่มสถานะเมื่อกำไร" },
  gs_pyramid: {
    en: "Pyramiding: add to a winning position as it moves in your favor.",
    th: "Pyramiding: เพิ่มสถานะที่กำไรเมื่อราคาเคลื่อนตามที่คุณต้องการ",
  },
  gs_addon: {
    en: "Each add-on should be smaller than the last (50%, 25%).",
    th: "แต่ละครั้งที่เพิ่มควรเล็กกว่าครั้งก่อน (50%, 25%)",
  },
  gs_breakeven: {
    en: "Move stop loss to breakeven after first add-on.",
    th: "ย้าย Stop Loss ไปจุดเสมอตัวหลังเพิ่มสถานะครั้งแรก",
  },
  cuttingLosers: { en: "Cutting Losers Fast", th: "ตัดขาดทุนเร็ว" },
  gs_invalidated: {
    en: "If the reason you entered the trade no longer exists — exit immediately.",
    th: "ถ้าเหตุผลที่คุณเข้าเทรดไม่มีอีกแล้ว — ออกทันที",
  },
  gs_dont_wait: {
    en: "Don't wait for your stop loss to be hit if the thesis is invalidated.",
    th: "อย่ารอให้โดน Stop Loss ถ้าแนวคิดการเทรดถูกหักล้างแล้ว",
  },
  gs_cut: {
    en: "\"Cut losers short, let winners run.\"",
    th: "\"ตัดขาดทุนเร็ว ปล่อยกำไรวิ่ง\"",
  },

  // Bell Curve / Distribution of Trade Results
  bellCurveTitle: {
    en: "The Distribution of Your Trade Results",
    th: "การกระจายตัวของผลลัพธ์การเทรด",
  },
  bellCurve_intro: {
    en: "Every trade is a data point. Over a large sample size, these points don't spread out randomly forever — they cluster together into a distribution. This distribution is the Bell Curve.",
    th: "ทุกเทรดคือจุดข้อมูล เมื่อมีจำนวนตัวอย่างมากพอ จุดเหล่านี้ไม่ได้กระจายแบบสุ่มตลอดไป — มันรวมกลุ่มกันเป็นรูปแบบการกระจาย รูปแบบนี้คือ Bell Curve",
  },
  bellCurve_xAxis: { en: "Number of Trades", th: "จำนวนเทรด" },
  bellCurve_yAxis: { en: "Profit / Loss", th: "กำไร / ขาดทุน" },
  bellCurve_avgResult: { en: "Your Average Result", th: "ผลลัพธ์เฉลี่ยของคุณ" },
  bellCurve_expectancy: { en: "Expectancy", th: "Expectancy" },
  bellCurve_losses: { en: "Losses", th: "ขาดทุน" },
  bellCurve_wins: { en: "Wins", th: "กำไร" },
  bellCurve_most: { en: "Most of your trades", th: "เทรดส่วนใหญ่ของคุณ" },
  bellCurve_most_desc: {
    en: "Will be small wins and small losses",
    th: "จะเป็นกำไรเล็กน้อยและขาดทุนเล็กน้อย",
  },
  bellCurve_some: { en: "Some of your trades", th: "บางส่วนของเทรด" },
  bellCurve_some_desc: {
    en: "Will be bigger wins or bigger losses",
    th: "จะเป็นกำไรที่มากขึ้นหรือขาดทุนที่มากขึ้น",
  },
  bellCurve_few: { en: "Very few trades", th: "เทรดส่วนน้อยมาก" },
  bellCurve_few_desc: {
    en: "Will be extreme, outlier outcomes",
    th: "จะเป็นผลลัพธ์ที่สุดขั้ว เป็นค่าผิดปกติ",
  },
  bellCurve_centerTitle: {
    en: "The Center of the Curve is the Only Number That Matters",
    th: "จุดกึ่งกลางของเส้นโค้งคือตัวเลขเดียวที่สำคัญ",
  },
  bellCurve_center_desc: {
    en: "This central point is your average result per trade. In statistical terms, it is your Expectancy. It represents the true performance of your trading strategy, stripped of all short-term noise and emotion.",
    th: "จุดกลางนี้คือผลลัพธ์เฉลี่ยต่อเทรดของคุณ ในทางสถิติ มันคือ Expectancy ของคุณ มันแสดงถึงประสิทธิภาพที่แท้จริงของกลยุทธ์การเทรด ตัดเสียงรบกวนระยะสั้นและอารมณ์ออกทั้งหมด",
  },

  // Expectancy Formula Breakdown
  expectancyBreakdownTitle: {
    en: "How to Calculate the Center of Your Curve: The Expectancy Formula",
    th: "วิธีคำนวณจุดกึ่งกลางของเส้นโค้ง: สูตร Expectancy",
  },
  expectancy_math_def: {
    en: "Expectancy is the mathematical definition of your edge.",
    th: "Expectancy คือนิยามทางคณิตศาสตร์ของข้อได้เปรียบของคุณ",
  },
  exp_engine: {
    en: "Win % x Avg. Win Size",
    th: "Win % x ขนาดชนะเฉลี่ย",
  },
  exp_engine_desc: {
    en: "How much you make from your winning trades. This is the engine of your profit.",
    th: "คุณทำเงินได้เท่าไหร่จากเทรดที่ชนะ นี่คือเครื่องยนต์ของกำไร",
  },
  exp_cost: {
    en: "Loss % x Avg. Loss Size",
    th: "Loss % x ขนาดขาดทุนเฉลี่ย",
  },
  exp_cost_desc: {
    en: "How much you give back from your losing trades. This is the cost of doing business.",
    th: "คุณคืนเท่าไหร่จากเทรดที่แพ้ นี่คือต้นทุนของการทำธุรกิจ",
  },

  // Sample Size
  sampleSizeTitle: {
    en: "Your True Performance is Only Revealed with a Large Sample Size",
    th: "ผลงานที่แท้จริงของคุณเปิดเผยได้ด้วยจำนวนตัวอย่างที่มาก",
  },
  sampleSize_intro: {
    en: "You cannot judge a strategy from 5 trades. You need hundreds of data points before the bell curve takes shape and your true edge becomes visible.",
    th: "คุณไม่สามารถตัดสินกลยุทธ์จาก 5 เทรดได้ คุณต้องมีจุดข้อมูลหลายร้อยจุดก่อนที่ Bell Curve จะเป็นรูปเป็นร่างและข้อได้เปรียบที่แท้จริงของคุณจะมองเห็นได้",
  },
  ss_5trades: { en: "5 Trades", th: "5 เทรด" },
  ss_100trades: { en: "100+ Trades", th: "100+ เทรด" },
  ss_500trades: { en: "500+ Trades", th: "500+ เทรด" },
  ss_noise: { en: "Random Noise", th: "เสียงรบกวนแบบสุ่ม" },
  ss_edge_appearing: { en: "Your Edge Starts to Appear", th: "ข้อได้เปรียบเริ่มปรากฏ" },
  ss_edge_real: { en: "Your Edge is Statistically Real", th: "ข้อได้เปรียบของคุณเป็นจริงทางสถิติ" },
  ss_quote: {
    en: "\"Only large sample sizes reveal truth.\"",
    th: "\"มีเพียงจำนวนตัวอย่างที่มากเท่านั้นที่เปิดเผยความจริง\"",
  },
  ss_quote_desc: {
    en: "Don't change your strategy after 10 trades. Don't celebrate after 10 wins. Get to 100+ trades, then evaluate. The math needs data to work.",
    th: "อย่าเปลี่ยนกลยุทธ์หลังจาก 10 เทรด อย่าฉลองหลังจากชนะ 10 ครั้ง ทำให้ถึง 100+ เทรด แล้วค่อยประเมิน คณิตศาสตร์ต้องการข้อมูลเพื่อทำงาน",
  },

  // Core Mechanics - Market Structure
  marketStructureTitle: { en: "Market Structure", th: "โครงสร้างตลาด" },
  hhHl: { en: "Higher Highs & Higher Lows = Uptrend", th: "จุดสูงสุดใหม่ & จุดต่ำสุดที่สูงขึ้น = ขาขึ้น" },
  hh_hl_desc: {
    en: "Each swing high is higher than the last. Each pullback holds above the previous low.",
    th: "จุดแกว่งตัวสูงแต่ละครั้งสูงกว่าครั้งก่อน จุดดึงกลับแต่ละครั้งอยู่เหนือจุดต่ำสุดก่อนหน้า",
  },
  hh_hl_break: {
    en: "Structure breaks when price makes a lower low — the trend may be ending.",
    th: "โครงสร้างเปลี่ยนเมื่อราคาทำจุดต่ำสุดใหม่ — แนวโน้มอาจจะจบ",
  },
  lhLl: { en: "Lower Highs & Lower Lows = Downtrend", th: "จุดสูงสุดที่ต่ำลง & จุดต่ำสุดใหม่ = ขาลง" },
  lh_ll_desc: {
    en: "Each rally fails at a lower price. Each drop pushes to new lows.",
    th: "การดีดตัวแต่ละครั้งล้มเหลวที่ราคาที่ต่ำกว่า การลงแต่ละครั้งทำจุดต่ำสุดใหม่",
  },
  lh_ll_break: {
    en: "Structure breaks when price makes a higher high.",
    th: "โครงสร้างเปลี่ยนเมื่อราคาทำจุดสูงสุดใหม่",
  },
  bosCore: { en: "Break of Structure (BOS)", th: "การทะลุโครงสร้าง (BOS)" },
  bos_violates: {
    en: "When price violates the last significant swing point, structure has changed.",
    th: "เมื่อราคาทะลุจุดแกว่งตัวสำคัญสุดท้าย โครงสร้างได้เปลี่ยนแล้ว",
  },
  bos_early: {
    en: "This is your early warning signal that the trend is shifting.",
    th: "นี่คือสัญญาณเตือนล่วงหน้าว่าแนวโน้มกำลังเปลี่ยน",
  },
  bos_wait: {
    en: "Wait for confirmation (retest of broken level) before entering.",
    th: "รอการยืนยัน (ทดสอบระดับที่ถูกทะลุอีกครั้ง) ก่อนเข้าเทรด",
  },

  // Core Mechanics - Trend vs Range
  trendVsRangeTitle: { en: "Trend vs Range", th: "แนวโน้มกับกรอบราคา" },
  tradingTrends: { en: "Trading Trends", th: "การเทรดตามแนวโน้ม" },
  trend_buy_pullback: {
    en: "Buy pullbacks in an uptrend (at higher lows).",
    th: "ซื้อตอนดึงกลับในขาขึ้น (ที่จุดต่ำสุดที่สูงขึ้น)",
  },
  trend_sell_rally: {
    en: "Sell rallies in a downtrend (at lower highs).",
    th: "ขายตอนดีดตัวในขาลง (ที่จุดสูงสุดที่ต่ำลง)",
  },
  trend_friend: {
    en: "The trend is your friend — trade WITH it, not against it.",
    th: "แนวโน้มคือเพื่อนของคุณ — เทรดตามมัน ไม่ใช่สวนทาง",
  },
  tradingRanges: { en: "Trading Ranges", th: "การเทรดในกรอบราคา" },
  range_buy_sell: {
    en: "Buy at support, sell at resistance.",
    th: "ซื้อที่แนวรับ ขายที่แนวต้าน",
  },
  range_breakout: {
    en: "Ranges eventually break out — watch for volume on the breakout.",
    th: "กรอบราคาจะถูกทะลุในที่สุด — จับตาปริมาณตอนทะลุ",
  },
  range_false: {
    en: "Most false breakouts happen on low volume. Wait for confirmation.",
    th: "การทะลุหลอกส่วนใหญ่เกิดขึ้นเมื่อปริมาณน้อย รอการยืนยัน",
  },

  // Core Mechanics - Multi-Timeframe tab
  mtfTitle: { en: "Multi-Timeframe Analysis", th: "การวิเคราะห์หลายไทม์เฟรม" },
  topDownApproach: { en: "Top-Down Approach", th: "การวิเคราะห์จากบนลงล่าง" },
  mtf_higher: {
    en: "Higher timeframe (Daily/Weekly) = determine the TREND direction.",
    th: "ไทม์เฟรมสูง (รายวัน/รายสัปดาห์) = กำหนดทิศทางแนวโน้ม",
  },
  mtf_middle: {
    en: "Middle timeframe (4H) = identify KEY LEVELS (S/R).",
    th: "ไทม์เฟรมกลาง (4H) = ระบุระดับสำคัญ (แนวรับ/แนวต้าน)",
  },
  mtf_lower: {
    en: "Lower timeframe (1H/15min) = find your ENTRY trigger.",
    th: "ไทม์เฟรมต่ำ (1H/15m) = หาจุดเข้าเทรด",
  },
  mtf_never: {
    en: "Never take a trade on the lower timeframe that conflicts with the higher timeframe direction.",
    th: "อย่าเทรดในไทม์เฟรมต่ำที่ขัดกับทิศทางของไทม์เฟรมสูง",
  },

  // Smart Money Concepts
  smc_intro: {
    en: "Smart Money Concepts (SMC) reverse-engineer how institutional traders (banks, hedge funds, market makers) move markets. Retail traders lose because they trade against this flow. Learn to read the footprints institutions leave behind and trade with them, not against them.",
    th: "Smart Money Concepts (SMC) วิเคราะห์ย้อนกลับวิธีที่เทรดเดอร์สถาบัน (ธนาคาร, กองทุนเฮดจ์ฟันด์, มาร์เก็ตเมกเกอร์) ขับเคลื่อนตลาด เทรดเดอร์รายย่อยแพ้เพราะเทรดสวนกระแสนี้ เรียนรู้ที่จะอ่านรอยเท้าที่สถาบันทิ้งไว้และเทรดตามพวกเขา ไม่ใช่สวนทาง",
  },
  breaksInStructure: { en: "Breaks in Structure", th: "การทะลุโครงสร้าง" },
  fairValueGaps: { en: "Fair Value Gaps", th: "ช่องว่างมูลค่ายุติธรรม" },
  imbalanceAreas: { en: "Imbalance Areas", th: "พื้นที่ไม่สมดุล" },
  reactionZones: { en: "Reaction Zones", th: "โซนปฏิกิริยา" },

  // BOS tab
  bosCHoCH: { en: "Break of Structure (BOS) & Change of Character (CHoCH)", th: "การทะลุโครงสร้าง (BOS) & การเปลี่ยนลักษณะ (CHoCH)" },
  bos_diagram_desc: {
    en: "Uptrend: HH → HH → HH then fails. Price breaks below the last HL = Change of Character",
    th: "ขาขึ้น: HH → HH → HH แล้วล้มเหลว ราคาทะลุลงต่ำกว่า HL สุดท้าย = การเปลี่ยนลักษณะ",
  },
  bosTitle: { en: "Break of Structure (BOS)", th: "การทะลุโครงสร้าง (BOS)" },
  bos_desc: {
    en: "A BOS happens when price breaks a previous swing high (in uptrend) or swing low (in downtrend), continuing the current trend.",
    th: "BOS เกิดขึ้นเมื่อราคาทะลุจุดแกว่งตัวสูงก่อนหน้า (ในขาขึ้น) หรือจุดแกว่งตัวต่ำ (ในขาลง) ต่อเนื่องแนวโน้มปัจจุบัน",
  },
  bos_bullish: {
    en: "Bullish BOS: Price breaks above the last swing high → uptrend continues.",
    th: "BOS ขาขึ้น: ราคาทะลุเหนือจุดแกว่งตัวสูงสุดท้าย → ขาขึ้นต่อ",
  },
  bos_bearish: {
    en: "Bearish BOS: Price breaks below the last swing low → downtrend continues.",
    th: "BOS ขาลง: ราคาทะลุต่ำกว่าจุดแกว่งตัวต่ำสุดท้าย → ขาลงต่อ",
  },
  bos_intact: {
    en: "BOS = trend continuation. The structure is intact.",
    th: "BOS = แนวโน้มต่อเนื่อง โครงสร้างยังสมบูรณ์",
  },
  chochTitle: { en: "Change of Character (CHoCH)", th: "การเปลี่ยนลักษณะ (CHoCH)" },
  choch_desc: {
    en: "A CHoCH happens when price breaks structure in the opposite direction, signaling a potential trend reversal.",
    th: "CHoCH เกิดขึ้นเมื่อราคาทะลุโครงสร้างในทิศทางตรงข้าม ส่งสัญญาณการกลับตัวที่อาจเกิดขึ้น",
  },
  choch_bullish: {
    en: "Bullish CHoCH: In a downtrend, price breaks above the last lower high → trend might be shifting to bullish.",
    th: "CHoCH ขาขึ้น: ในขาลง ราคาทะลุเหนือจุดสูงสุดที่ต่ำลงสุดท้าย → แนวโน้มอาจเปลี่ยนเป็นขาขึ้น",
  },
  choch_bearish: {
    en: "Bearish CHoCH: In an uptrend, price breaks below the last higher low → trend might be shifting to bearish.",
    th: "CHoCH ขาลง: ในขาขึ้น ราคาทะลุต่ำกว่าจุดต่ำสุดที่สูงขึ้นสุดท้าย → แนวโน้มอาจเปลี่ยนเป็นขาลง",
  },
  choch_warning: {
    en: "CHoCH = early warning of reversal. Wait for confirmation before trading.",
    th: "CHoCH = สัญญาณเตือนล่วงหน้าของการกลับตัว รอการยืนยันก่อนเทรด",
  },
  howToTradeBOS: { en: "How to Trade BOS & CHoCH", th: "วิธีเทรด BOS & CHoCH" },
  bos_entries: {
    en: "BOS entries: After a bullish BOS, wait for a pullback to the broken level (now support). Enter on a bullish candle confirmation. Stop below the pullback low.",
    th: "เข้าเทรด BOS: หลัง BOS ขาขึ้น รอการดึงกลับไปยังระดับที่ถูกทะลุ (ตอนนี้เป็นแนวรับ) เข้าเมื่อแท่งเทียนขาขึ้นยืนยัน ตั้ง Stop ใต้จุดต่ำสุดของการดึงกลับ",
  },
  choch_entries: {
    en: "CHoCH entries: After a CHoCH, don't immediately reverse. Wait for:",
    th: "เข้าเทรด CHoCH: หลัง CHoCH อย่ากลับทิศทันที รอ:",
  },
  choch_step1: {
    en: "1. A retest of the broken structure level",
    th: "1. การทดสอบระดับโครงสร้างที่ถูกทะลุอีกครั้ง",
  },
  choch_step2: {
    en: "2. A confirming BOS in the new direction",
    th: "2. BOS ที่ยืนยันในทิศทางใหม่",
  },
  choch_step3: {
    en: "3. A lower timeframe entry trigger at the retest zone",
    th: "3. สัญญาณเข้าเทรดในไทม์เฟรมต่ำที่โซนทดสอบ",
  },

  // FVG tab
  fvgTitle: { en: "Fair Value Gaps (FVG)", th: "ช่องว่างมูลค่ายุติธรรม (FVG)" },
  fvg_diagram_desc: {
    en: "FVG = gap between Candle 1 high and Candle 3 low. Price returns to fill the gap before continuing.",
    th: "FVG = ช่องว่างระหว่างจุดสูงสุดแท่งเทียน 1 และจุดต่ำสุดแท่งเทียน 3 ราคากลับมาเติมช่องว่างก่อนไปต่อ",
  },
  whatIsFVG: { en: "What is a Fair Value Gap?", th: "Fair Value Gap คืออะไร?" },
  fvg_desc: {
    en: "An FVG forms when a candle moves so aggressively that a gap is left between the wick of the candle before it (Candle 1) and the wick of the candle after it (Candle 3). The middle candle (Candle 2) created the imbalance.",
    th: "FVG เกิดขึ้นเมื่อแท่งเทียนเคลื่อนที่อย่างรุนแรงจนเกิดช่องว่างระหว่างไส้เทียนของแท่งเทียนก่อนหน้า (แท่ง 1) และไส้เทียนของแท่งเทียนหลัง (แท่ง 3) แท่งเทียนตรงกลาง (แท่ง 2) สร้างความไม่สมดุล",
  },
  fvg_bullish: {
    en: "Bullish FVG: Candle 1 HIGH is lower than Candle 3 LOW → gap above. Price tends to drop back into this zone before continuing up.",
    th: "FVG ขาขึ้น: จุดสูงสุดแท่ง 1 ต่ำกว่าจุดต่ำสุดแท่ง 3 → ช่องว่างด้านบน ราคามักดิ่งกลับเข้าโซนนี้ก่อนไปต่อ",
  },
  fvg_bearish: {
    en: "Bearish FVG: Candle 1 LOW is higher than Candle 3 HIGH → gap below. Price tends to rally back into this zone before continuing down.",
    th: "FVG ขาลง: จุดต่ำสุดแท่ง 1 สูงกว่าจุดสูงสุดแท่ง 3 → ช่องว่างด้านล่าง ราคามักดีดกลับเข้าโซนนี้ก่อนลงต่อ",
  },
  whyFVGFilled: { en: "Why FVGs Get Filled", th: "ทำไม FVG ถูกเติม" },
  fvg_efficiency: {
    en: "Markets seek efficiency. When price moves too fast, it leaves behind unfilled orders. The market \"wants\" to return and fill those orders.",
    th: "ตลาดแสวงหาประสิทธิภาพ เมื่อราคาเคลื่อนที่เร็วเกินไป มันทิ้งคำสั่งที่ยังไม่ถูกเติมไว้ ตลาด \"ต้องการ\" กลับมาเติมคำสั่งเหล่านั้น",
  },
  fvg_elastic: {
    en: "Think of it as an elastic band — the further it stretches, the harder it snaps back.",
    th: "คิดซะว่าเป็นยางยืด — ยิ่งยืดไกล ยิ่งดีดกลับแรง",
  },
  fvg_percent: {
    en: "~70% of FVGs get at least partially filled.",
    th: "~70% ของ FVG ถูกเติมอย่างน้อยบางส่วน",
  },
  tradingFVGs: { en: "Trading FVGs", th: "การเทรด FVG" },
  fvg_entry: {
    en: "Entry: Wait for price to retrace INTO the FVG zone. Look for a rejection candle (pin bar, engulfing) inside the gap.",
    th: "จุดเข้า: รอราคาดึงกลับเข้าสู่โซน FVG มองหาแท่งเทียนปฏิเสธ (pin bar, engulfing) ภายในช่องว่าง",
  },
  fvg_stop: {
    en: "Stop: Below the FVG zone (bullish) or above it (bearish).",
    th: "Stop: ใต้โซน FVG (ขาขึ้น) หรือเหนือโซน (ขาลง)",
  },
  fvg_target: {
    en: "Target: The high/low that created the gap, or the next structure level.",
    th: "เป้าหมาย: จุดสูงสุด/ต่ำสุดที่สร้างช่องว่าง หรือระดับโครงสร้างถัดไป",
  },
  fvg_best: {
    en: "Best FVGs: Those aligned with the higher timeframe trend and near other confluence (S/R, order blocks).",
    th: "FVG ที่ดีที่สุด: ที่สอดคล้องกับแนวโน้มไทม์เฟรมสูงและใกล้จุดรวมตัวอื่น (แนวรับ/แนวต้าน, order blocks)",
  },

  // Imbalance tab
  imbalanceTitle: { en: "Imbalance Areas", th: "พื้นที่ไม่สมดุล" },
  imbalance_diagram_desc: {
    en: "Imbalance = extreme one-sided pressure. Big candles, minimal wicks, one direction.",
    th: "ไม่สมดุล = แรงกดดันฝ่ายเดียวอย่างรุนแรง แท่งเทียนใหญ่ ไส้เทียนน้อย ทิศทางเดียว",
  },
  whatCreatesImbalance: { en: "What Creates an Imbalance?", th: "อะไรสร้างความไม่สมดุล?" },
  imb_desc: {
    en: "An imbalance forms when there is a massive disparity between buying and selling pressure. One side completely overwhelms the other.",
    th: "ความไม่สมดุลเกิดขึ้นเมื่อมีความแตกต่างอย่างมากระหว่างแรงซื้อและแรงขาย ฝ่ายหนึ่งครอบงำอีกฝ่ายอย่างสิ้นเชิง",
  },
  imb_visual: { en: "Visual clues of imbalance:", th: "สัญญาณทางสายตาของความไม่สมดุล:" },
  imb_large: {
    en: "- Multiple large-bodied candles in a row (same direction)",
    th: "- แท่งเทียนตัวใหญ่หลายแท่งติดต่อกัน (ทิศทางเดียวกัน)",
  },
  imb_no_wick: {
    en: "- Very small or no wicks (no opposition)",
    th: "- ไส้เทียนเล็กมากหรือไม่มี (ไม่มีการต่อต้าน)",
  },
  imb_volume: {
    en: "- Above-average volume on each candle",
    th: "- ปริมาณเหนือค่าเฉลี่ยในแต่ละแท่งเทียน",
  },
  imb_displacement: {
    en: "- This is also called displacement — institutional urgency",
    th: "- เรียกอีกอย่างว่า displacement — ความเร่งด่วนของสถาบัน",
  },
  imbVsFVG: { en: "Imbalance vs Fair Value Gap", th: "ความไม่สมดุล vs Fair Value Gap" },
  imb_fvg_is: {
    en: "FVG is a specific 3-candle pattern with a measurable price gap. It's a subset of imbalance.",
    th: "FVG คือรูปแบบ 3 แท่งเทียนเฉพาะที่มีช่องว่างราคาที่วัดได้ เป็นส่วนย่อยของความไม่สมดุล",
  },
  imb_area_is: {
    en: "Imbalance area is the entire zone created by the aggressive move. It includes FVGs, order blocks, and the displacement candles.",
    th: "พื้นที่ไม่สมดุลคือโซนทั้งหมดที่สร้างโดยการเคลื่อนไหวที่รุนแรง รวมถึง FVG, order blocks และแท่งเทียน displacement",
  },
  imb_forest: {
    en: "Think of imbalance as the forest and FVGs as individual trees within it.",
    th: "คิดว่าความไม่สมดุลเป็นป่า และ FVG เป็นต้นไม้แต่ละต้นในป่า",
  },
  tradingImbalance: { en: "Trading Imbalance Areas", th: "การเทรดพื้นที่ไม่สมดุล" },
  imb_bullish: {
    en: "After a bullish imbalance: Price should retrace to the imbalance zone. The 50% level of the move (equilibrium) is the highest probability entry.",
    th: "หลังความไม่สมดุลขาขึ้น: ราคาควรดึงกลับเข้าโซนไม่สมดุล ระดับ 50% ของการเคลื่อนไหว (จุดสมดุล) คือจุดเข้าที่มีความน่าจะเป็นสูงสุด",
  },
  imb_bearish: {
    en: "After a bearish imbalance: Price should rally back into the imbalance zone. Short at the 50% retracement.",
    th: "หลังความไม่สมดุลขาลง: ราคาควรดีดกลับเข้าโซนไม่สมดุล เปิด Short ที่จุดดึงกลับ 50%",
  },
  imb_valid: {
    en: "If price returns to an imbalance zone and fails to push through → the imbalance is still valid. Look for entries.",
    th: "ถ้าราคากลับเข้าโซนไม่สมดุลและไม่สามารถทะลุผ่านได้ → ความไม่สมดุลยังมีผลอยู่ มองหาจุดเข้า",
  },
  institutionalProfiles: { en: "Institutional Candle Profiles", th: "โปรไฟล์แท่งเทียนสถาบัน" },
  strongBuying: { en: "Strong Buying", th: "ซื้อแรง" },
  strongSelling: { en: "Strong Selling", th: "ขายแรง" },
  rejection: { en: "Rejection", th: "ปฏิเสธ" },
  indecisionCandle: { en: "Indecision", th: "ลังเล" },
  bigBodyTinyWicks: { en: "Big body, tiny wicks", th: "ตัวเทียนใหญ่ ไส้เทียนเล็ก" },
  longLowerWick: { en: "Long lower wick = buyers rejected low", th: "ไส้เทียนล่างยาว = ผู้ซื้อปฏิเสธราคาต่ำ" },
  dojiNoImbalance: { en: "Doji = no imbalance", th: "Doji = ไม่มีความไม่สมดุล" },

  // Reaction Zones tab
  reactionTitle: { en: "Reaction Zones (Order Blocks & Demand/Supply)", th: "โซนปฏิกิริยา (Order Blocks & อุปสงค์/อุปทาน)" },
  reactionDiagramDesc: {
    en: "Order Block = last opposing candle before displacement. Price returns and bounces from it.",
    th: "Order Block = แท่งเทียนตรงข้ามสุดท้ายก่อน displacement ราคากลับมาและเด้งจากมัน",
  },
  demandZones: { en: "Demand Zones (Bullish Order Blocks)", th: "โซนอุปสงค์ (Bullish Order Blocks)" },
  demand_desc: {
    en: "A demand zone is the last bearish candle before a strong bullish move (displacement upward).",
    th: "โซนอุปสงค์คือแท่งเทียนขาลงสุดท้ายก่อนการเคลื่อนไหวขาขึ้นอย่างแรง (displacement ขึ้น)",
  },
  demand_why: {
    en: "Why it works: Institutions placed massive buy orders here. When price returns, they defend their position by buying again.",
    th: "ทำไมมันได้ผล: สถาบันวางคำสั่งซื้อจำนวนมากที่นี่ เมื่อราคากลับมา พวกเขาปกป้องสถานะโดยซื้ออีกครั้ง",
  },
  demand_how: { en: "How to identify:", th: "วิธีระบุ:" },
  demand_step1: { en: "1. Find a strong bullish move (3+ big green candles)", th: "1. หาการเคลื่อนไหวขาขึ้นแรง (แท่งเทียนเขียวใหญ่ 3+ แท่ง)" },
  demand_step2: { en: "2. Mark the last RED candle before the move", th: "2. ทำเครื่องหมายแท่งเทียนแดงสุดท้ายก่อนการเคลื่อนไหว" },
  demand_step3: { en: "3. The zone = that candle's high to low", th: "3. โซน = จุดสูงสุดถึงจุดต่ำสุดของแท่งเทียนนั้น" },
  demand_step4: { en: "4. Wait for price to return to this zone", th: "4. รอราคากลับมาที่โซนนี้" },
  supplyZones: { en: "Supply Zones (Bearish Order Blocks)", th: "โซนอุปทาน (Bearish Order Blocks)" },
  supply_desc: {
    en: "A supply zone is the last bullish candle before a strong bearish move (displacement downward).",
    th: "โซนอุปทานคือแท่งเทียนขาขึ้นสุดท้ายก่อนการเคลื่อนไหวขาลงอย่างแรง (displacement ลง)",
  },
  supply_why: {
    en: "Why it works: Institutions placed massive sell orders here. When price returns, they add to shorts or dump more.",
    th: "ทำไมมันได้ผล: สถาบันวางคำสั่งขายจำนวนมากที่นี่ เมื่อราคากลับมา พวกเขาเพิ่ม Short หรือขายเพิ่ม",
  },
  supply_step1: { en: "1. Find a strong bearish move (3+ big red candles)", th: "1. หาการเคลื่อนไหวขาลงแรง (แท่งเทียนแดงใหญ่ 3+ แท่ง)" },
  supply_step2: { en: "2. Mark the last GREEN candle before the move", th: "2. ทำเครื่องหมายแท่งเทียนเขียวสุดท้ายก่อนการเคลื่อนไหว" },
  supply_step3: { en: "3. The zone = that candle's high to low", th: "3. โซน = จุดสูงสุดถึงจุดต่ำสุดของแท่งเทียนนั้น" },
  supply_step4: { en: "4. Wait for price to return to this zone", th: "4. รอราคากลับมาที่โซนนี้" },
  liquidityStopHunts: { en: "Liquidity & Stop Hunts", th: "สภาพคล่อง & Stop Hunt" },
  liq_intro: {
    en: "Smart money needs liquidity to fill large orders. They can't buy 1 million shares without moving the price — unless there are sellers to match.",
    th: "Smart Money ต้องการสภาพคล่องเพื่อเติมคำสั่งขนาดใหญ่ พวกเขาไม่สามารถซื้อ 1 ล้านหุ้นโดยไม่ขยับราคา — เว้นแต่จะมีผู้ขายมาจับคู่",
  },
  liq_where: {
    en: "Where is liquidity? Where retail traders place their stop losses:",
    th: "สภาพคล่องอยู่ที่ไหน? ที่ที่เทรดเดอร์รายย่อยวาง Stop Loss:",
  },
  liq_below_support: { en: "- Below obvious support levels (buy stop losses)", th: "- ใต้แนวรับที่ชัดเจน (Stop Loss ของฝั่งซื้อ)" },
  liq_above_resistance: { en: "- Above obvious resistance levels (sell stop losses)", th: "- เหนือแนวต้านที่ชัดเจน (Stop Loss ของฝั่งขาย)" },
  liq_equal: { en: "- Below/above equal highs or equal lows (easy targets)", th: "- ใต้/เหนือจุดสูงสุดเท่ากันหรือจุดต่ำสุดเท่ากัน (เป้าหมายง่าย)" },
  liq_sequence: { en: "The classic sequence:", th: "ลำดับคลาสสิก:" },
  liq_step1: { en: "1. Price approaches a key level with many stops", th: "1. ราคาเข้าใกล้ระดับสำคัญที่มี Stop จำนวนมาก" },
  liq_step2: { en: "2. Price spikes through the level, triggering all the stops", th: "2. ราคาพุ่งทะลุระดับ กระตุ้น Stop ทั้งหมด" },
  liq_step3: { en: "3. Smart money fills their orders against those stops", th: "3. Smart Money เติมคำสั่งของพวกเขาจาก Stop เหล่านั้น" },
  liq_step4: { en: "4. Price immediately reverses in the real direction", th: "4. ราคากลับตัวทันทีในทิศทางจริง" },
  liq_why: {
    en: "This is why your stop gets hit \"to the tick\" before the move happens.",
    th: "นี่คือเหตุผลที่ Stop ของคุณโดน \"พอดีเป๊ะ\" ก่อนที่การเคลื่อนไหวจะเกิดขึ้น",
  },
  puttingTogether: { en: "Putting It All Together", th: "รวมทุกอย่างเข้าด้วยกัน" },
  together_intro: {
    en: "The highest-probability SMC setup combines multiple elements:",
    th: "เซ็ตอัพ SMC ที่มีความน่าจะเป็นสูงสุดรวมหลายองค์ประกอบ:",
  },

  // Multi-Timeframe Deep Dive
  mta_intro: {
    en: "Multi-timeframe analysis (MTA) is how professional traders stack the odds. You read the market on multiple timeframes simultaneously — each one serves a different purpose. This is the single most important skill that separates beginners from consistently profitable traders.",
    th: "การวิเคราะห์หลายไทม์เฟรม (MTA) คือวิธีที่เทรดเดอร์มืออาชีพเพิ่มโอกาส คุณอ่านตลาดในหลายไทม์เฟรมพร้อมกัน — แต่ละอันมีจุดประสงค์ต่างกัน นี่คือทักษะสำคัญที่สุดที่แยกมือใหม่ออกจากเทรดเดอร์ที่ทำกำไรได้อย่างสม่ำเสมอ",
  },
  tfHierarchy: { en: "The Timeframe Hierarchy", th: "ลำดับชั้นไทม์เฟรม" },
  tf_monthly_role: { en: "Macro trend & big picture bias", th: "แนวโน้มมหภาค & ภาพรวม" },
  tf_weekly_role: { en: "Major S/R zones, institutional levels", th: "โซนแนวรับ/แนวต้านหลัก ระดับสถาบัน" },
  tf_daily_role: { en: "Primary trend direction & key levels", th: "ทิศทางแนวโน้มหลัก & ระดับสำคัญ" },
  tf_4h_role: { en: "Swing trade setups & structure", th: "เซ็ตอัพ Swing Trade & โครงสร้าง" },
  tf_1h_role: { en: "Intraday structure & zone refinement", th: "โครงสร้างระหว่างวัน & ปรับปรุงโซน" },
  tf_30m_role: { en: "Day trade setups & confirmation", th: "เซ็ตอัพเทรดรายวัน & การยืนยัน" },
  tf_15m_role: { en: "Entry timing & trigger candles", th: "จังหวะเข้า & แท่งเทียนสัญญาณ" },
  tf_5m_role: { en: "Scalp entries & precise stop placement", th: "จุดเข้า Scalp & การวาง Stop อย่างแม่นยำ" },
  tf_higher_weight: {
    en: "Higher timeframes carry more weight. A signal on the daily overrules the 15-minute.",
    th: "ไทม์เฟรมสูงมีน้ำหนักมากกว่า สัญญาณบนรายวันเหนือกว่า 15 นาที",
  },
  threeTimeframeRule: { en: "The 3-Timeframe Rule", th: "กฎ 3 ไทม์เฟรม" },
  three_tf_intro: {
    en: "Always use exactly 3 timeframes — no more, no less. Each serves a distinct purpose:",
    th: "ใช้ 3 ไทม์เฟรมเสมอ — ไม่มากไม่น้อย แต่ละอันมีจุดประสงค์เฉพาะ:",
  },
  higherTF: { en: "HIGHER TF", th: "ไทม์เฟรมสูง" },
  middleTF: { en: "MIDDLE TF", th: "ไทม์เฟรมกลาง" },
  lowerTF: { en: "LOWER TF", th: "ไทม์เฟรมต่ำ" },
  trendDirection: { en: "Trend Direction", th: "ทิศทางแนวโน้ม" },
  setupStructure: { en: "Setup & Structure", th: "เซ็ตอัพ & โครงสร้าง" },
  entryTrigger: { en: "Entry Trigger", th: "สัญญาณเข้า" },
  riverFlowing: { en: "\"Which way is the river flowing?\"", th: "\"แม่น้ำไหลไปทางไหน?\"" },
  keyLevelsWhere: { en: "\"Where are the key levels?\"", th: "\"ระดับสำคัญอยู่ที่ไหน?\"" },
  whenEnter: { en: "\"When exactly do I enter?\"", th: "\"เข้าเทรดตอนไหนกันแน่?\"" },
  tfCombinations: { en: "Timeframe Combinations by Trading Style", th: "การจับคู่ไทม์เฟรมตามสไตล์การเทรด" },
  style: { en: "Style", th: "สไตล์" },
  holdTime: { en: "Hold Time", th: "ระยะเวลาถือ" },
  scalper: { en: "Scalper", th: "Scalper" },
  dayTrader: { en: "Day Trader", th: "Day Trader" },
  intradaySwing: { en: "Intraday Swing", th: "Intraday Swing" },
  swingTrader: { en: "Swing Trader", th: "Swing Trader" },
  positionTrader: { en: "Position Trader", th: "Position Trader" },
  investor: { en: "Investor", th: "นักลงทุน" },
  secondsMinutes: { en: "Seconds to minutes", th: "วินาทีถึงนาที" },
  minutesHours: { en: "Minutes to hours", th: "นาทีถึงชั่วโมง" },
  hoursDay: { en: "Hours to 1 day", th: "ชั่วโมงถึง 1 วัน" },
  daysWeeks: { en: "Days to weeks", th: "วันถึงสัปดาห์" },
  weeksMonths: { en: "Weeks to months", th: "สัปดาห์ถึงเดือน" },
  monthsYears: { en: "Months to years", th: "เดือนถึงปี" },
  scalperNote: {
    en: "*1-minute charts are not available in backtesting but are used for live scalping.",
    th: "*กราฟ 1 นาทีไม่มีในการทดสอบย้อนหลังแต่ใช้สำหรับ Scalp สด",
  },
  threeScreenMethod: { en: "The 3-Screen Method (Swing Trader Example)", th: "วิธี 3 หน้าจอ (ตัวอย่าง Swing Trader)" },
  screen1Daily: { en: "Screen 1 — Daily", th: "หน้าจอ 1 — รายวัน" },
  screen1Decision: {
    en: "Decision: Trend is UP (HH + HL). Only look for LONG setups.",
    th: "การตัดสินใจ: แนวโน้มขึ้น (HH + HL) มองหาเซ็ตอัพ LONG เท่านั้น",
  },
  screen2_4H: { en: "Screen 2 — 4H", th: "หน้าจอ 2 — 4H" },
  screen2Decision: {
    en: "Decision: Price pulling back to support at $105. This is a buy zone.",
    th: "การตัดสินใจ: ราคาดึงกลับมาที่แนวรับ $105 นี่คือโซนซื้อ",
  },
  screen3_1H: { en: "Screen 3 — 1H", th: "หน้าจอ 3 — 1H" },
  screen3Decision: {
    en: "Decision: Hammer + bullish engulfing at support. ENTER long with stop below $103.50.",
    th: "การตัดสินใจ: Hammer + Bullish Engulfing ที่แนวรับ เข้า Long โดย Stop ต่ำกว่า $103.50",
  },
  mtfWorkflow: { en: "Step-by-Step MTF Workflow", th: "ขั้นตอน MTF ทีละขั้น" },
  mtf_step1_title: { en: "Higher TF — Identify the trend", th: "ไทม์เฟรมสูง — ระบุแนวโน้ม" },
  mtf_step1_desc: {
    en: "Open the daily chart. Is price making HH/HL (uptrend) or LH/LL (downtrend)? If sideways, mark the range boundaries. This determines your bias — you only take trades in this direction.",
    th: "เปิดกราฟรายวัน ราคาทำ HH/HL (ขาขึ้น) หรือ LH/LL (ขาลง)? ถ้าไซด์เวย์ ทำเครื่องหมายขอบเขตกรอบราคา สิ่งนี้กำหนดอคติของคุณ — คุณเทรดในทิศทางนี้เท่านั้น",
  },
  mtf_step2_title: { en: "Middle TF — Find the setup zone", th: "ไทม์เฟรมกลาง — หาโซนเซ็ตอัพ" },
  mtf_step2_desc: {
    en: "Drop to the 4H chart. Look for price approaching a key level (support in uptrend, resistance in downtrend). Mark order blocks, FVGs, or S/R zones where you expect a reaction.",
    th: "ลงไปที่กราฟ 4H มองหาราคาเข้าใกล้ระดับสำคัญ (แนวรับในขาขึ้น, แนวต้านในขาลง) ทำเครื่องหมาย order blocks, FVG หรือโซนแนวรับ/แนวต้านที่คุณคาดว่าจะมีปฏิกิริยา",
  },
  mtf_step3_title: { en: "Lower TF — Execute the entry", th: "ไทม์เฟรมต่ำ — ดำเนินการเข้าเทรด" },
  mtf_step3_desc: {
    en: "Drop to the 1H or 15m chart. Wait for a confirmation candle at the setup zone: engulfing, pin bar, or break of structure. Place your entry, stop loss, and target.",
    th: "ลงไปที่กราฟ 1H หรือ 15m รอแท่งเทียนยืนยันที่โซนเซ็ตอัพ: engulfing, pin bar หรือการทะลุโครงสร้าง วางจุดเข้า, stop loss และเป้าหมาย",
  },
  mtf_step4_title: { en: "Manage on the middle TF", th: "จัดการบนไทม์เฟรมกลาง" },
  mtf_step4_desc: {
    en: "Once in the trade, manage it on the middle timeframe. Don't watch the 5-minute chart — it will scare you out of good trades. Trail your stop using the middle TF structure.",
    th: "เมื่ออยู่ในเทรดแล้ว จัดการบนไทม์เฟรมกลาง อย่าดูกราฟ 5 นาที — มันจะทำให้คุณกลัวจนออกจากเทรดที่ดี ลาก Stop ตามโครงสร้างไทม์เฟรมกลาง",
  },
  confluenceHighProb: { en: "Confluence = High Probability", th: "Confluence = ความน่าจะเป็นสูง" },
  confluence_intro: {
    en: "When all 3 timeframes agree, you have confluence — the highest probability setup:",
    th: "เมื่อทั้ง 3 ไทม์เฟรมเห็นพ้อง คุณมี confluence — เซ็ตอัพที่มีความน่าจะเป็นสูงสุด:",
  },
  confluence_agree: {
    en: "All 3 agree = take the trade with confidence.",
    th: "ทั้ง 3 เห็นพ้อง = เข้าเทรดอย่างมั่นใจ",
  },
  conflictNoTrade: { en: "Conflict = No Trade", th: "ขัดแย้ง = ไม่เทรด" },
  conflict_intro: {
    en: "When timeframes disagree, stand aside:",
    th: "เมื่อไทม์เฟรมขัดแย้ง ยืนข้างสนาม:",
  },
  conflict_trap: {
    en: "The 1H bullish candle is a counter-trend trap. Skip it.",
    th: "แท่งเทียนขาขึ้นบน 1H คือกับดักสวนเทรนด์ ข้ามไป",
  },
  commonMTFMistakes: { en: "Common Multi-Timeframe Mistakes", th: "ข้อผิดพลาด MTF ที่พบบ่อย" },
  mistakeTooMany: { en: "Mistake: Too Many Timeframes", th: "ผิดพลาด: ไทม์เฟรมมากเกินไป" },
  mistake_too_many: {
    en: "Checking 6 charts leads to \"analysis paralysis.\" You find conflicting signals and can't decide.",
    th: "ดู 6 กราฟนำไปสู่ \"analysis paralysis\" คุณเจอสัญญาณที่ขัดแย้งและตัดสินใจไม่ได้",
  },
  mistake_too_many_fix: { en: "Fix: Stick to exactly 3 timeframes. No more.", th: "แก้ไข: ยึดติดกับ 3 ไทม์เฟรมเท่านั้น ไม่มากกว่านี้" },
  mistakeHigherTF: { en: "Mistake: Entering on the Higher TF", th: "ผิดพลาด: เข้าเทรดบนไทม์เฟรมสูง" },
  mistake_higher: {
    en: "Seeing a daily signal and entering immediately gives you a huge stop loss and terrible risk/reward.",
    th: "เห็นสัญญาณบนรายวันแล้วเข้าทันทีทำให้ Stop Loss ใหญ่มากและ risk/reward แย่",
  },
  mistake_higher_fix: {
    en: "Fix: Use the lower TF to find a tight entry within the daily zone.",
    th: "แก้ไข: ใช้ไทม์เฟรมต่ำเพื่อหาจุดเข้าที่แน่นภายในโซนรายวัน",
  },
  mistakeFighting: { en: "Mistake: Fighting the Higher TF", th: "ผิดพลาด: สวนไทม์เฟรมสูง" },
  mistake_fighting: {
    en: "The 15m shows a perfect bullish setup but the daily is in a strong downtrend. This is a trap.",
    th: "15m แสดงเซ็ตอัพขาขึ้นสมบูรณ์แบบแต่รายวันอยู่ในขาลงแรง นี่คือกับดัก",
  },
  mistake_fighting_fix: {
    en: "Fix: The higher timeframe always wins. If daily is bearish, only short.",
    th: "แก้ไข: ไทม์เฟรมสูงชนะเสมอ ถ้ารายวันเป็นขาลง เปิด Short เท่านั้น",
  },
  mistakeManaging: { en: "Mistake: Managing on the Entry TF", th: "ผิดพลาด: จัดการบนไทม์เฟรมเข้าเทรด" },
  mistake_managing: {
    en: "Watching the 5-minute after a 4H swing setup. Every red candle triggers panic.",
    th: "ดูกราฟ 5 นาทีหลังเซ็ตอัพ Swing 4H แท่งเทียนแดงทุกแท่งกระตุ้นความตื่นตระหนก",
  },
  mistake_managing_fix: {
    en: "Fix: Set your stop based on the middle TF, then step away from the lower TF.",
    th: "แก้ไข: ตั้ง Stop ตามไทม์เฟรมกลาง แล้วออกจากไทม์เฟรมต่ำ",
  },
  realExample: { en: "Real Example: Day Trading AAPL", th: "ตัวอย่างจริง: Day Trade AAPL" },
  indicatorsByTF: { en: "Which Indicators Work Best on Each Timeframe?", th: "ตัวชี้วัดไหนทำงานดีที่สุดในแต่ละไทม์เฟรม?" },
  ind_5m_15m: {
    en: "5m-15m: VWAP, EMA(9/21), volume bars. Keep it simple — speed matters.",
    th: "5m-15m: VWAP, EMA(9/21), แท่งปริมาณ ทำให้ง่าย — ความเร็วสำคัญ",
  },
  ind_30m_1h: {
    en: "30m-1h: EMA(20/50), RSI(14), MACD. Good balance of signal quality and speed.",
    th: "30m-1h: EMA(20/50), RSI(14), MACD สมดุลที่ดีระหว่างคุณภาพสัญญาณและความเร็ว",
  },
  ind_4h_1d: {
    en: "4h-1d: EMA(50/200), ADX, Bollinger Bands, MACD. Fewer false signals.",
    th: "4h-1d: EMA(50/200), ADX, Bollinger Bands, MACD สัญญาณหลอกน้อยกว่า",
  },
  ind_1wk_1mo: {
    en: "1wk-1mo: SMA(50/200), monthly pivots. Only the biggest moves matter here.",
    th: "1wk-1mo: SMA(50/200), จุดหมุนรายเดือน เฉพาะการเคลื่อนไหวใหญ่ที่สุดเท่านั้นที่สำคัญ",
  },

  // Language picker
  language: { en: "Language", th: "ภาษา" },
  english: { en: "English", th: "English" },
  thai: { en: "ไทย", th: "ไทย" },
};

export function t(key: string, lang: Lang): string {
  return translations[key]?.[lang] ?? translations[key]?.en ?? key;
}

export default translations;
