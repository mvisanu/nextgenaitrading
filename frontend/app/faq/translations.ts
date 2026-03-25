export type Lang = "en" | "th";

export const t = {
  // Page header
  pageTitle: { en: "FAQ & Strategy Reference", th: "FAQ & คู่มือกลยุทธ์" },
  heroTitle: { en: "Strategy Rules & FAQ", th: "กฎกลยุทธ์ & คำถามที่พบบ่อย" },
  heroDesc: {
    en: "Everything you need to know about each strategy mode, indicators, backtesting mechanics, and platform features.",
    th: "ทุกสิ่งที่คุณต้องรู้เกี่ยวกับโหมดกลยุทธ์แต่ละแบบ ตัวชี้วัด กลไกการทดสอบย้อนหลัง และฟีเจอร์ของแพลตฟอร์ม",
  },

  // Section titles
  sectionComparison: { en: "Strategy Comparison at a Glance", th: "เปรียบเทียบกลยุทธ์โดยสรุป" },
  sectionConservative: { en: "Conservative Strategy", th: "กลยุทธ์แบบอนุรักษ์นิยม (Conservative)" },
  sectionAggressive: { en: "Aggressive Strategy", th: "กลยุทธ์แบบเชิงรุก (Aggressive)" },
  sectionAiPick: { en: "AI Pick Optimizer", th: "ตัวเพิ่มประสิทธิภาพ AI Pick" },
  sectionBlsh: { en: "Buy Low / Sell High Optimizer", th: "ตัวเพิ่มประสิทธิภาพ ซื้อต่ำ / ขายสูง" },
  sectionBacktest: { en: "Backtesting Engine", th: "เครื่องมือทดสอบย้อนหลัง" },
  sectionCooldown: { en: "Cooldown Mechanics", th: "กลไกช่วงพัก (Cooldown)" },
  sectionIndicators: { en: "Indicator Glossary", th: "คำศัพท์ตัวชี้วัด" },
  sectionPineScript: { en: "Pine Script Artifacts", th: "Pine Script Artifacts" },
  sectionFaq: { en: "Frequently Asked Questions", th: "คำถามที่พบบ่อย" },

  // Comparison table headers
  feature: { en: "Feature", th: "คุณสมบัติ" },
  conservative: { en: "Conservative", th: "อนุรักษ์นิยม" },
  aggressive: { en: "Aggressive", th: "เชิงรุก" },
  aiPick: { en: "AI Pick", th: "AI Pick" },
  buyLowSellHigh: { en: "Buy Low/Sell High", th: "ซื้อต่ำ/ขายสูง" },

  // Comparison table rows
  leverage: { en: "Leverage", th: "เลเวอเรจ" },
  logicType: { en: "Logic Type", th: "ประเภทตรรกะ" },
  minConfirmations: { en: "Min Confirmations", th: "จำนวนยืนยันขั้นต่ำ" },
  trailingStop: { en: "Trailing Stop", th: "Trailing Stop" },
  variantsTested: { en: "Variants Tested", th: "จำนวนรูปแบบที่ทดสอบ" },
  cooldownBars: { en: "Cooldown Bars", th: "แท่งพัก (Cooldown)" },
  pineScriptExport: { en: "Pine Script Export", th: "ส่งออก Pine Script" },
  entryCondition: { en: "Entry Condition", th: "เงื่อนไขเข้า" },
  exitCondition: { en: "Exit Condition", th: "เงื่อนไขออก" },

  // Comparison table values
  hmmIndicators: { en: "HMM + 8 Indicators", th: "HMM + 8 ตัวชี้วัด" },
  macdRsiEmaOpt: { en: "MACD/RSI/EMA Optimizer", th: "MACD/RSI/EMA ตัวเพิ่มประสิทธิภาพ" },
  rsiBollingerOpt: { en: "RSI/Bollinger Optimizer", th: "RSI/Bollinger ตัวเพิ่มประสิทธิภาพ" },
  none: { en: "None", th: "ไม่มี" },
  yes: { en: "Yes", th: "ใช่" },
  no: { en: "No", th: "ไม่" },
  na: { en: "N/A", th: "ไม่มี" },
  bullRegime7: { en: "Bull regime + 7 confirms", th: "ช่วงขาขึ้น + ยืนยัน 7 สัญญาณ" },
  bullRegime5: { en: "Bull regime + 5 confirms", th: "ช่วงขาขึ้น + ยืนยัน 5 สัญญาณ" },
  macdRsiEmaSignals: { en: "MACD/RSI/EMA signals", th: "สัญญาณ MACD/RSI/EMA" },
  rsiOversoldBbLower: { en: "RSI oversold + BB lower", th: "RSI oversold + BB ล่าง" },
  bearRegime: { en: "Bear regime", th: "ช่วงขาลง" },
  bearRegimeOrTrail: { en: "Bear regime or trail stop", th: "ช่วงขาลง หรือ trail stop" },
  variantSellSignal: { en: "Variant sell signal", th: "สัญญาณขายของรูปแบบ" },
  overboughtOrBbUpper: { en: "Overbought or BB upper", th: "Overbought หรือ BB บน" },

  // Conservative strategy
  conservativeDesc: {
    en: 'The Conservative strategy uses a <strong class="text-foreground">2-state Hidden Markov Model (HMM)</strong> to detect whether the market is in a <span class="text-[#26a69a]">bull</span> or <span class="text-[#ef5350]">bear</span> regime. It then requires <strong class="text-foreground">7 out of 8</strong> technical indicators to confirm before entering a trade. This is the safest mode — designed for capital preservation with fewer but higher-confidence entries.',
    th: 'กลยุทธ์อนุรักษ์นิยมใช้ <strong class="text-foreground">Hidden Markov Model (HMM) แบบ 2 สถานะ</strong> เพื่อตรวจจับว่าตลาดอยู่ในช่วง<span class="text-[#26a69a]">ขาขึ้น (bull)</span> หรือ <span class="text-[#ef5350]">ขาลง (bear)</span> จากนั้นต้องการตัวชี้วัดทางเทคนิค <strong class="text-foreground">7 จาก 8 ตัว</strong> ยืนยันก่อนเข้าเทรด นี่คือโหมดที่ปลอดภัยที่สุด — ออกแบบมาเพื่อรักษาเงินทุนด้วยการเข้าเทรดน้อยลงแต่มีความมั่นใจสูงขึ้น',
  },
  hmmRegimeDetection: { en: "HMM Regime Detection", th: "การตรวจจับช่วงตลาดด้วย HMM" },
  hmmDesc: {
    en: 'A Gaussian HMM with 2 hidden states is fitted on three features: <strong class="text-foreground">log returns</strong>, <strong class="text-foreground">ATR</strong> (14-period), and <strong class="text-foreground">volume ratio</strong> (current volume / 20-bar avg). The state with the higher mean return is labeled "bull"; the other is "bear". Requires at least 60 bars of data to train.',
    th: 'Gaussian HMM แบบ 2 สถานะซ่อนเร้น ถูกฝึกจากข้อมูล 3 อย่าง: <strong class="text-foreground">log returns</strong>, <strong class="text-foreground">ATR</strong> (14 แท่ง), และ <strong class="text-foreground">อัตราส่วนปริมาณ</strong> (ปริมาณปัจจุบัน / ค่าเฉลี่ย 20 แท่ง) สถานะที่มีผลตอบแทนเฉลี่ยสูงกว่าจะถูกตั้งชื่อว่า "bull" อีกสถานะคือ "bear" ต้องการข้อมูลอย่างน้อย 60 แท่ง',
  },
  eightConfirmations: { en: "8 Confirmation Signals", th: "สัญญาณยืนยัน 8 ตัว" },
  entryExitRules: { en: "Entry & Exit Rules", th: "กฎการเข้าและออก" },
  buy: { en: "BUY", th: "ซื้อ" },
  sell: { en: "SELL", th: "ขาย" },
  hold: { en: "HOLD", th: "ถือ" },
  buyConservativeRule: {
    en: 'Regime = bull <span class="text-foreground font-semibold">AND</span> confirmations ≥ 7',
    th: 'ช่วงตลาด = bull <span class="text-foreground font-semibold">และ</span> ยืนยัน ≥ 7',
  },
  sellConservativeRule: {
    en: "Regime = bear (regardless of confirmations)",
    th: "ช่วงตลาด = bear (ไม่ว่าจำนวนยืนยันจะเท่าไร)",
  },
  holdConservativeRule: {
    en: "Regime = bull but < 7 confirmations",
    th: "ช่วงตลาด = bull แต่ยืนยัน < 7",
  },

  // Indicator descriptions
  rsiPurpose: { en: "RSI < 70 — not overbought", th: "RSI < 70 — ยังไม่ overbought" },
  macdPurpose: { en: "MACD line > Signal line — bullish crossover", th: "เส้น MACD > เส้น Signal — สัญญาณขาขึ้น" },
  emaPurpose: { en: "EMA₂₀ > EMA₅₀ — short-term uptrend", th: "EMA₂₀ > EMA₅₀ — แนวโน้มขาขึ้นระยะสั้น" },
  bollingerPurpose: { en: "Price > lower band — above support", th: "ราคา > แถบล่าง — อยู่เหนือแนวรับ" },
  adxPurpose: { en: "ADX > 20 — market is trending", th: "ADX > 20 — ตลาดมีแนวโน้ม" },
  obvPurpose: { en: "OBV increasing — volume confirms price", th: "OBV เพิ่มขึ้น — ปริมาณยืนยันราคา" },
  atrPurpose: { en: "ATR > 0 — market has volatility", th: "ATR > 0 — ตลาดมีความผันผวน" },
  volumePurpose: { en: "Volume ratio > 0.8 — above-average activity", th: "อัตราส่วนปริมาณ > 0.8 — กิจกรรมเหนือค่าเฉลี่ย" },

  // Aggressive strategy
  aggressiveDesc: {
    en: 'Same HMM regime detection and 8 indicators as Conservative, but with a <strong class="text-foreground">lower confirmation gate (5/8)</strong> and <strong class="text-foreground">higher leverage (4.0x)</strong>. Enters trades more frequently with more risk per trade. A <strong class="text-foreground">5% trailing stop</strong> actively protects against sharp reversals.',
    th: 'ใช้ HMM และ 8 ตัวชี้วัดเหมือนกับอนุรักษ์นิยม แต่มี<strong class="text-foreground">เกณฑ์ยืนยันที่ต่ำกว่า (5/8)</strong> และ <strong class="text-foreground">เลเวอเรจที่สูงกว่า (4.0x)</strong> เข้าเทรดบ่อยขึ้นพร้อมความเสี่ยงมากขึ้นต่อเทรด <strong class="text-foreground">Trailing stop 5%</strong> ช่วยป้องกันการกลับตัวรุนแรง',
  },
  whatsDifferent: { en: "What's Different from Conservative?", th: "แตกต่างจากอนุรักษ์นิยมอย่างไร?" },
  aggDiff1: {
    en: '<strong class="text-foreground">Relaxed gate:</strong> Only 5 of 8 indicators need to confirm (vs 7). More trades, but lower conviction per trade.',
    th: '<strong class="text-foreground">เกณฑ์ผ่อนคลาย:</strong> ต้องการเพียง 5 จาก 8 ตัวชี้วัดยืนยัน (เทียบกับ 7) เทรดมากขึ้น แต่ความมั่นใจต่อเทรดลดลง',
  },
  aggDiff2: {
    en: '<strong class="text-foreground">Higher leverage:</strong> 4.0x amplifies both gains and losses. A 2% move becomes an 8% portfolio impact.',
    th: '<strong class="text-foreground">เลเวอเรจสูงขึ้น:</strong> 4.0x ขยายทั้งกำไรและขาดทุน การเคลื่อนไหว 2% กลายเป็นผลกระทบ 8% ต่อพอร์ต',
  },
  aggDiff3: {
    en: '<strong class="text-foreground">Trailing stop:</strong> Tracks the highest price during a trade. If price drops 5% from that peak, the position is closed automatically.',
    th: '<strong class="text-foreground">Trailing stop:</strong> ติดตามราคาสูงสุดระหว่างเทรด หากราคาลดลง 5% จากจุดสูงสุด ตำแหน่งจะถูกปิดโดยอัตโนมัติ',
  },
  trailingStopMechanics: { en: "Trailing Stop Mechanics", th: "กลไก Trailing Stop" },
  trailingStopDesc: {
    en: 'During each bar of an open trade, the engine tracks the <strong class="text-foreground">highest price reached</strong>. If the current price falls to <code class="bg-secondary/60 px-1 rounded">highest_price × (1 − 0.05)</code>, the position is closed with exit reason <code class="bg-secondary/60 px-1 rounded">"trailing_stop"</code>.',
    th: 'ในแต่ละแท่งของเทรดที่เปิดอยู่ เครื่องมือจะติดตาม<strong class="text-foreground">ราคาสูงสุดที่เคยถึง</strong> หากราคาปัจจุบันลดลงถึง <code class="bg-secondary/60 px-1 rounded">ราคาสูงสุด × (1 − 0.05)</code> ตำแหน่งจะถูกปิดด้วยเหตุผล <code class="bg-secondary/60 px-1 rounded">"trailing_stop"</code>',
  },
  exitConditions3: { en: "Exit Conditions (3 possible)", th: "เงื่อนไขออก (3 แบบ)" },
  signalExit: { en: "Signal Exit", th: "ออกตามสัญญาณ" },
  signalExitDesc: { en: "HMM regime switches to bear", th: "HMM เปลี่ยนเป็นช่วงขาลง" },
  trailingStopLabel: { en: "Trailing Stop", th: "Trailing Stop" },
  trailingStopExitDesc: { en: "Price drops 5% from peak", th: "ราคาลดลง 5% จากจุดสูงสุด" },
  endOfData: { en: "End of Data", th: "สิ้นสุดข้อมูล" },
  endOfDataDesc: { en: "Backtest ends with open position", th: "การทดสอบย้อนหลังจบลงพร้อมตำแหน่งที่เปิดอยู่" },

  // AI Pick
  aiPickDesc: {
    en: 'The AI Pick optimizer does <strong class="text-foreground">not use HMM</strong>. Instead, it systematically tests <strong class="text-foreground">12 parameter combinations</strong> of MACD, RSI, and EMA indicators, backtests each variant, then selects the winner with the best risk-adjusted score.',
    th: 'ตัวเพิ่มประสิทธิภาพ AI Pick <strong class="text-foreground">ไม่ใช้ HMM</strong> แต่จะทดสอบ<strong class="text-foreground">พารามิเตอร์ 12 ชุด</strong>ของ MACD, RSI, และ EMA อย่างเป็นระบบ ทดสอบย้อนหลังแต่ละรูปแบบ แล้วเลือกผู้ชนะที่มีคะแนนปรับความเสี่ยงดีที่สุด',
  },
  parameterGrid12: { en: "Parameter Grid (12 Variants)", th: "ตารางพารามิเตอร์ (12 รูปแบบ)" },
  parameter: { en: "Parameter", th: "พารามิเตอร์" },
  valuesTested: { en: "Values Tested", th: "ค่าที่ทดสอบ" },
  buyWhenAllTrue: { en: "BUY when all true", th: "ซื้อ เมื่อเป็นจริงทั้งหมด" },
  sellWhenAnyTrue: { en: "SELL when any true", th: "ขาย เมื่อเป็นจริงอย่างใดอย่างหนึ่ง" },
  buySellLogic: { en: "Buy / Sell Logic (per Variant)", th: "ตรรกะ ซื้อ / ขาย (ต่อรูปแบบ)" },
  variantSelection: { en: "Variant Selection Process", th: "ขั้นตอนการเลือกรูปแบบ" },
  variantStep1: { en: "Run all 12 variants against historical data", th: "รันทั้ง 12 รูปแบบกับข้อมูลย้อนหลัง" },
  variantStep2: { en: "Split data: 60% train, 20% validation, 20% test", th: "แบ่งข้อมูล: 60% ฝึก, 20% ตรวจสอบ, 20% ทดสอบ" },
  variantStep3: {
    en: 'Score each variant: <code class="bg-secondary/60 px-1 rounded">validation_return / (1 + max_drawdown)</code>',
    th: 'ให้คะแนนแต่ละรูปแบบ: <code class="bg-secondary/60 px-1 rounded">validation_return / (1 + max_drawdown)</code>',
  },
  variantStep4: { en: "Top-ranked variant becomes the winner", th: "รูปแบบอันดับหนึ่งเป็นผู้ชนะ" },
  variantStep5: { en: "Pine Script v5 code is generated mirroring the winner's logic", th: "สร้างโค้ด Pine Script v5 ตามตรรกะของผู้ชนะ" },

  // BLSH
  blshDesc: {
    en: 'A mean-reversion optimizer that buys when price is at <strong class="text-foreground">Bollinger lower band + RSI oversold</strong>, and sells when price reaches the <strong class="text-foreground">upper band or RSI overbought</strong>. Tests 8 parameter combinations and selects the best performer.',
    th: 'ตัวเพิ่มประสิทธิภาพ mean-reversion ที่ซื้อเมื่อราคาอยู่ที่<strong class="text-foreground">แถบ Bollinger ล่าง + RSI oversold</strong> และขายเมื่อราคาถึง<strong class="text-foreground">แถบบน หรือ RSI overbought</strong> ทดสอบ 8 ชุดพารามิเตอร์และเลือกตัวที่ดีที่สุด',
  },
  parameterGrid8: { en: "Parameter Grid (8 Variants)", th: "ตารางพารามิเตอร์ (8 รูปแบบ)" },
  regimeStates: { en: "Regime States", th: "สถานะของช่วงตลาด" },
  dipBuy: { en: "DIP (Buy)", th: "DIP (ซื้อ)" },
  dipDesc: {
    en: 'RSI < oversold threshold <span class="text-foreground font-semibold">AND</span> Price < BB lower band. Hold for cycle_hold_bars.',
    th: 'RSI < เกณฑ์ oversold <span class="text-foreground font-semibold">และ</span> ราคา < แถบ BB ล่าง ถือไว้ตาม cycle_hold_bars',
  },
  topSell: { en: "TOP (Sell)", th: "TOP (ขาย)" },
  topDesc: {
    en: 'RSI > 65 <span class="text-foreground font-semibold">OR</span> Price > BB upper band. Exit immediately.',
    th: 'RSI > 65 <span class="text-foreground font-semibold">หรือ</span> ราคา > แถบ BB บน ออกทันที',
  },
  neutral: { en: "NEUTRAL", th: "กลาง" },
  neutralDesc: { en: "Neither condition met. Continue holding or waiting.", th: "ไม่ตรงเงื่อนไขใดเลย ถือต่อหรือรอ" },
  fixedParams: { en: "Fixed Parameters", th: "พารามิเตอร์คงที่" },

  // Backtest engine
  backtestDesc: {
    en: "All four strategies run through the same backtesting engine. The engine simulates trades on historical data and calculates performance metrics.",
    th: "กลยุทธ์ทั้ง 4 แบบรันผ่านเครื่องมือทดสอบย้อนหลังเดียวกัน เครื่องมือจำลองการเทรดกับข้อมูลย้อนหลังและคำนวณตัวชี้วัดประสิทธิภาพ",
  },
  dataSplitting: { en: "Data Splitting", th: "การแบ่งข้อมูล" },
  train: { en: "Train", th: "ฝึก" },
  val: { en: "Val", th: "ตรวจสอบ" },
  test: { en: "Test", th: "ทดสอบ" },
  performanceMetrics: { en: "Performance Metrics", th: "ตัวชี้วัดประสิทธิภาพ" },
  totalReturn: { en: "Total Return", th: "ผลตอบแทนรวม" },
  totalReturnDesc: { en: "Compounded % return across all trades on the equity curve", th: "ผลตอบแทน % ทบต้นจากทุกเทรดบนเส้นมูลค่าพอร์ต" },
  maxDrawdown: { en: "Max Drawdown", th: "การลดลงสูงสุด" },
  maxDrawdownDesc: { en: "Largest peak-to-trough decline — measures worst-case loss", th: "การลดลงจากจุดสูงสุดถึงจุดต่ำสุดมากที่สุด — วัดการขาดทุนกรณีเลวร้ายที่สุด" },
  sharpeLike: { en: "Sharpe-like", th: "คล้าย Sharpe" },
  sharpeLikeDesc: { en: "Mean leveraged return / std deviation — risk-adjusted performance", th: "ผลตอบแทนเลเวอเรจเฉลี่ย / ส่วนเบี่ยงเบนมาตรฐาน — ประสิทธิภาพปรับความเสี่ยง" },
  validationScore: { en: "Validation Score", th: "คะแนนตรวจสอบ" },
  validationScoreDesc: {
    en: '<code class="bg-secondary/60 px-1 rounded">val_return / (1 + max_drawdown)</code> — used to rank optimizer variants',
    th: '<code class="bg-secondary/60 px-1 rounded">val_return / (1 + max_drawdown)</code> — ใช้จัดอันดับรูปแบบของ optimizer',
  },
  winRate: { en: "Win Rate", th: "อัตราชนะ" },
  winRateDesc: { en: "Percentage of trades with positive return", th: "เปอร์เซ็นต์ของเทรดที่ได้กำไร" },
  returnCalc: { en: "Return Calculation", th: "การคำนวณผลตอบแทน" },

  // Cooldown
  cooldownDesc: {
    en: 'After every trade exit, a <strong class="text-foreground">cooldown period</strong> prevents immediate re-entry. This avoids whipsaw trades — rapid buy/sell cycles that erode capital through fees and slippage.',
    th: 'หลังจากออกจากเทรดทุกครั้ง <strong class="text-foreground">ช่วงพัก (cooldown)</strong> จะป้องกันการเข้าเทรดซ้ำทันที เพื่อหลีกเลี่ยง whipsaw — การซื้อ/ขายรวดเร็วที่กัดกร่อนเงินทุนผ่านค่าธรรมเนียมและ slippage',
  },
  consAggAiCooldown: { en: "Conservative / Aggressive / AI Pick", th: "อนุรักษ์นิยม / เชิงรุก / AI Pick" },
  consAggAiCooldownDesc: {
    en: '<strong class="text-foreground">3 bars</strong> after each exit before next entry is allowed',
    th: '<strong class="text-foreground">3 แท่ง</strong> หลังจากออกก่อนอนุญาตให้เข้าเทรดใหม่',
  },
  blshCooldown: { en: "Buy Low / Sell High", th: "ซื้อต่ำ / ขายสูง" },
  blshCooldownDesc: {
    en: '<strong class="text-foreground">2 bars</strong> — shorter cooldown since the strategy has a mandatory hold period built in',
    th: '<strong class="text-foreground">2 แท่ง</strong> — cooldown สั้นกว่าเพราะกลยุทธ์มีช่วงถือบังคับอยู่แล้ว',
  },
  cooldownHowItWorks: {
    en: '<strong class="text-foreground">How it works:</strong> Exit trade → counter set to N → each subsequent bar decrements counter → when counter reaches 0, new entries are allowed again.',
    th: '<strong class="text-foreground">ทำงานอย่างไร:</strong> ออกจากเทรด → ตั้งตัวนับเป็น N → แต่ละแท่งลดตัวนับ → เมื่อตัวนับถึง 0 อนุญาตให้เข้าเทรดใหม่ได้',
  },

  // Indicator glossary
  rsiTitle: { en: "RSI (Relative Strength Index)", th: "RSI (ดัชนีความแข็งแกร่งสัมพัทธ์)" },
  rsiDesc: {
    en: "Momentum oscillator measuring speed/magnitude of price changes on a 0-100 scale. Above 70 = overbought (likely to reverse down). Below 30 = oversold (likely to bounce). Used in all four strategies.",
    th: "ออสซิลเลเตอร์โมเมนตัมวัดความเร็ว/ขนาดของการเปลี่ยนแปลงราคาบนสเกล 0-100 เหนือ 70 = overbought (มีแนวโน้มกลับลง) ต่ำกว่า 30 = oversold (มีแนวโน้มเด้ง) ใช้ในกลยุทธ์ทั้ง 4 แบบ",
  },
  macdTitle: { en: "MACD (Moving Average Convergence Divergence)", th: "MACD (Moving Average Convergence Divergence)" },
  macdDesc: {
    en: "Trend-following indicator. MACD line = EMA₁₂ − EMA₂₆. Signal line = 9-period EMA of MACD. When MACD crosses above signal = bullish. Below = bearish. Used in Conservative, Aggressive, and AI Pick.",
    th: "ตัวชี้วัดตามแนวโน้ม เส้น MACD = EMA₁₂ − EMA₂₆ เส้น Signal = EMA 9 แท่งของ MACD เมื่อ MACD ตัดขึ้นเหนือ signal = ขาขึ้น ตัดลง = ขาลง ใช้ในอนุรักษ์นิยม เชิงรุก และ AI Pick",
  },
  emaTitle: { en: "EMA (Exponential Moving Average)", th: "EMA (ค่าเฉลี่ยเคลื่อนที่แบบเอ็กซ์โพเนนเชียล)" },
  emaDesc: {
    en: "A moving average that gives more weight to recent prices. When short-term EMA crosses above long-term EMA, it signals upward momentum. Conservative uses 20/50, AI Pick tests 10/50 and 20/100.",
    th: "ค่าเฉลี่ยเคลื่อนที่ที่ให้น้ำหนักมากกว่ากับราคาล่าสุด เมื่อ EMA ระยะสั้นตัดขึ้นเหนือ EMA ระยะยาว แสดงถึงโมเมนตัมขาขึ้น อนุรักษ์นิยมใช้ 20/50, AI Pick ทดสอบ 10/50 และ 20/100",
  },
  bollingerTitle: { en: "Bollinger Bands", th: "แถบ Bollinger" },
  bollingerDesc: {
    en: "Three lines: middle = SMA, upper/lower = middle ± 2 standard deviations. Price near lower band suggests oversold; near upper band suggests overbought. Used in Conservative/Aggressive (as confirmation) and Buy Low/Sell High (as primary signal).",
    th: "สามเส้น: กลาง = SMA, บน/ล่าง = กลาง ± 2 ส่วนเบี่ยงเบนมาตรฐาน ราคาใกล้แถบล่างบ่งบอก oversold ใกล้แถบบนบ่งบอก overbought ใช้ในอนุรักษ์นิยม/เชิงรุก (เป็นการยืนยัน) และซื้อต่ำ/ขายสูง (เป็นสัญญาณหลัก)",
  },
  adxTitle: { en: "ADX (Average Directional Index)", th: "ADX (ดัชนีทิศทางเฉลี่ย)" },
  adxDesc: {
    en: "Measures trend strength on a 0-100 scale. ADX > 20 means the market is trending (either direction). ADX < 20 means ranging/choppy. Used as confirmation in Conservative and Aggressive.",
    th: "วัดความแข็งแกร่งของแนวโน้มบนสเกล 0-100 ADX > 20 หมายถึงตลาดมีแนวโน้ม (ทิศทางใดก็ได้) ADX < 20 หมายถึง sideways/ไม่มีทิศทาง ใช้เป็นการยืนยันในอนุรักษ์นิยมและเชิงรุก",
  },
  obvTitle: { en: "OBV (On-Balance Volume)", th: "OBV (ปริมาณซื้อขายสะสม)" },
  obvDesc: {
    en: "Cumulative volume indicator. Adds volume on up days, subtracts on down days. Rising OBV confirms price trend with volume support. Used in Conservative and Aggressive.",
    th: "ตัวชี้วัดปริมาณสะสม เพิ่มปริมาณในวันขึ้น ลดในวันลง OBV ที่เพิ่มขึ้นยืนยันแนวโน้มราคาด้วยปริมาณสนับสนุน ใช้ในอนุรักษ์นิยมและเชิงรุก",
  },
  atrTitle: { en: "ATR (Average True Range)", th: "ATR (ช่วงเฉลี่ยที่แท้จริง)" },
  atrDesc: {
    en: "Measures market volatility — the average range of price movement over 14 bars. Higher ATR = more volatile market. Used as confirmation and as an HMM input feature.",
    th: "วัดความผันผวนของตลาด — ช่วงเฉลี่ยของการเคลื่อนไหวราคาใน 14 แท่ง ATR สูงขึ้น = ตลาดผันผวนมากขึ้น ใช้เป็นการยืนยันและเป็นข้อมูลอินพุตของ HMM",
  },
  hmmTitle: { en: "HMM (Hidden Markov Model)", th: "HMM (แบบจำลองมาร์คอฟซ่อนเร้น)" },
  hmmGlossaryDesc: {
    en: 'A statistical model that detects hidden "regimes" (bull/bear) from observable features (returns, volatility, volume). Learns state transition probabilities from historical data. Used exclusively by Conservative and Aggressive strategies.',
    th: 'แบบจำลองทางสถิติที่ตรวจจับ "ช่วงตลาด" ที่ซ่อนอยู่ (ขาขึ้น/ขาลง) จากข้อมูลที่สังเกตได้ (ผลตอบแทน ความผันผวน ปริมาณ) เรียนรู้ความน่าจะเป็นการเปลี่ยนสถานะจากข้อมูลย้อนหลัง ใช้เฉพาะในกลยุทธ์อนุรักษ์นิยมและเชิงรุก',
  },

  // Pine Script
  pineScriptDesc: {
    en: 'When an optimizer mode (AI Pick or Buy Low/Sell High) completes a run, the winning variant\'s logic is automatically converted into <strong class="text-foreground">TradingView Pine Script v5</strong> code. This code can be copied and pasted directly into TradingView\'s Pine Editor.',
    th: 'เมื่อโหมด optimizer (AI Pick หรือ ซื้อต่ำ/ขายสูง) รันเสร็จ ตรรกะของรูปแบบที่ชนะจะถูกแปลงเป็นโค้ด <strong class="text-foreground">TradingView Pine Script v5</strong> โดยอัตโนมัติ โค้ดนี้สามารถคัดลอกและวางลงใน Pine Editor ของ TradingView ได้โดยตรง',
  },
  generatedFor: { en: "Generated for:", th: "สร้างสำหรับ:" },
  generatedForVal: { en: "AI Pick (winner), Buy Low/Sell High (winner)", th: "AI Pick (ผู้ชนะ), ซื้อต่ำ/ขายสูง (ผู้ชนะ)" },
  notGeneratedFor: { en: "Not generated for:", th: "ไม่สร้างสำหรับ:" },
  notGeneratedForVal: { en: "Conservative, Aggressive (HMM is stateful and cannot be represented in Pine Script)", th: "อนุรักษ์นิยม, เชิงรุก (HMM มีสถานะและไม่สามารถแสดงใน Pine Script ได้)" },
  includes: { en: "Includes:", th: "รวมถึง:" },
  includesVal: { en: "Exact indicator windows/thresholds from the winning variant, entry/exit conditions, and inline comments", th: "ค่าหน้าต่าง/เกณฑ์ตัวชี้วัดที่แน่นอนจากรูปแบบที่ชนะ เงื่อนไขเข้า/ออก และคอมเมนต์ในบรรทัด" },
  whereToFind: { en: "Where to find:", th: "หาได้ที่:" },
  whereToFindVal: { en: "Artifacts page → each artifact shows mode, symbol, variant name, and copyable code", th: "หน้า Artifacts → แต่ละ artifact แสดงโหมด สัญลักษณ์ ชื่อรูปแบบ และโค้ดที่คัดลอกได้" },

  // FAQ questions & answers
  faqRealOrSim: { en: "Is this real trading or simulation?", th: "นี่คือการเทรดจริงหรือจำลอง?" },
  faqRealOrSimAnswer: {
    en: 'By default, all strategy runs are <strong class="text-foreground">backtests on historical data</strong> — no real money is at risk. The live trading page supports paper trading and real execution through broker integrations (Alpaca), but <strong class="text-foreground">dry-run mode is always the default</strong> and requires explicit opt-in for real trades.',
    th: 'โดยค่าเริ่มต้น การรันกลยุทธ์ทั้งหมดเป็น<strong class="text-foreground">การทดสอบย้อนหลังกับข้อมูลในอดีต</strong> — ไม่มีเงินจริงที่เสี่ยง หน้าเทรดสดรองรับ paper trading และการดำเนินการจริงผ่านโบรกเกอร์ (Alpaca) แต่<strong class="text-foreground">โหมด dry-run เป็นค่าเริ่มต้นเสมอ</strong> และต้องเลือกเปิดใช้งานสำหรับเทรดจริง',
  },
  faqHistData: { en: "How much historical data does the platform use?", th: "แพลตฟอร์มใช้ข้อมูลย้อนหลังเท่าไร?" },
  faqHistDataAnswer: {
    en: 'Data comes from <strong class="text-foreground">yfinance</strong> (free public data). Daily and weekly timeframes pull up to <strong class="text-foreground">730 days (2 years)</strong>. Intraday timeframes (5m, 15m, 30m) pull up to <strong class="text-foreground">60 days</strong>. 1-minute candles are limited to <strong class="text-foreground">7 days</strong>.',
    th: 'ข้อมูลมาจาก <strong class="text-foreground">yfinance</strong> (ข้อมูลสาธารณะฟรี) ไทม์เฟรมรายวันและรายสัปดาห์ดึงได้ถึง <strong class="text-foreground">730 วัน (2 ปี)</strong> ไทม์เฟรมอินทราเดย์ (5m, 15m, 30m) ดึงได้ถึง <strong class="text-foreground">60 วัน</strong> แท่งเทียน 1 นาทีจำกัดที่ <strong class="text-foreground">7 วัน</strong>',
  },
  faqLeverage: { en: "What does leverage actually do?", th: "เลเวอเรจทำงานอย่างไร?" },
  faqLeverageAnswer: {
    en: "Leverage multiplies your returns (and losses). With 2.5x leverage, a 4% price move becomes a 10% portfolio impact. The backtest engine compounds leveraged returns:",
    th: "เลเวอเรจคูณผลตอบแทนของคุณ (และการขาดทุน) ด้วยเลเวอเรจ 2.5x การเคลื่อนไหวราคา 4% จะกลายเป็นผลกระทบ 10% ต่อพอร์ต เครื่องมือทดสอบย้อนหลังทบต้นผลตอบแทนเลเวอเรจ:",
  },
  faqLeverageNote: {
    en: "Higher leverage means higher potential reward <em>and</em> higher potential loss.",
    th: "เลเวอเรจที่สูงขึ้นหมายถึงผลตอบแทนที่อาจสูงขึ้น<em>และ</em>การขาดทุนที่อาจสูงขึ้น",
  },
  faqValidation: { en: "What is the validation score and why does it matter?", th: "คะแนนตรวจสอบคืออะไรและทำไมถึงสำคัญ?" },
  faqValidationAnswer: {
    en: 'The validation score is <code class="bg-secondary/60 px-1 rounded">validation_return / (1 + max_drawdown)</code>. It rewards strategies that produce high returns while penalizing those with large drawdowns. This prevents the optimizer from selecting a variant that got lucky with one big trade but had dangerous risk exposure.',
    th: 'คะแนนตรวจสอบคือ <code class="bg-secondary/60 px-1 rounded">validation_return / (1 + max_drawdown)</code> ให้รางวัลกลยุทธ์ที่สร้างผลตอบแทนสูงขณะที่ลงโทษกลยุทธ์ที่มี drawdown มาก เพื่อป้องกันไม่ให้ optimizer เลือกรูปแบบที่โชคดีจากเทรดใหญ่หนึ่งครั้งแต่มีความเสี่ยงสูง',
  },
  faqPineScript: { en: "Why can't Conservative/Aggressive strategies export Pine Script?", th: "ทำไมกลยุทธ์อนุรักษ์นิยม/เชิงรุกส่งออก Pine Script ไม่ได้?" },
  faqPineScriptAnswer: {
    en: "These strategies use a <strong class=\"text-foreground\">Hidden Markov Model</strong>, which is a real-time statistical model that requires fitting on historical data and tracking hidden state transitions. Pine Script v5 doesn't support the matrix operations and probability calculations needed for HMM inference. Only the deterministic indicator-based optimizer strategies (AI Pick, BLSH) can be expressed in Pine Script.",
    th: "กลยุทธ์เหล่านี้ใช้ <strong class=\"text-foreground\">Hidden Markov Model</strong> ซึ่งเป็นแบบจำลองทางสถิติแบบเรียลไทม์ที่ต้องฝึกกับข้อมูลย้อนหลังและติดตามการเปลี่ยนสถานะที่ซ่อนอยู่ Pine Script v5 ไม่รองรับการดำเนินการเมทริกซ์และการคำนวณความน่าจะเป็นที่จำเป็นสำหรับ HMM ได้เฉพาะกลยุทธ์ optimizer ที่อิงตัวชี้วัด (AI Pick, BLSH) เท่านั้นที่แสดงใน Pine Script ได้",
  },
  faqSymbols: { en: "What symbols can I use?", th: "ใช้สัญลักษณ์อะไรได้บ้าง?" },
  faqSymbolsAnswer: {
    en: 'Any valid <strong class="text-foreground">yfinance ticker</strong>: US stocks (AAPL, TSLA, NVDA), crypto pairs (BTC-USD, ETH-USD, SOL-USD), ETFs (SPY, QQQ), indices (^GSPC, ^VIX), and international stocks. The platform validates the symbol before running.',
    th: '<strong class="text-foreground">ticker ของ yfinance</strong> ที่ถูกต้อง: หุ้นสหรัฐ (AAPL, TSLA, NVDA), คู่คริปโต (BTC-USD, ETH-USD, SOL-USD), ETFs (SPY, QQQ), ดัชนี (^GSPC, ^VIX) และหุ้นต่างประเทศ แพลตฟอร์มจะตรวจสอบสัญลักษณ์ก่อนรัน',
  },
  faqHmm: { en: "What is the HMM and how does it work?", th: "HMM คืออะไรและทำงานอย่างไร?" },
  faqHmmAnswer: {
    en: 'A <strong class="text-foreground">Gaussian Hidden Markov Model</strong> with 2 states is trained on three features: log returns, ATR, and volume ratio. It learns to classify the market into two regimes — the state with higher average returns is labeled "bull" and the other "bear". The model is fitted using 200 iterations with a fixed random seed (42) for reproducibility. It requires at least 60 bars of data.',
    th: '<strong class="text-foreground">Gaussian Hidden Markov Model</strong> แบบ 2 สถานะ ถูกฝึกจาก 3 ฟีเจอร์: log returns, ATR, และอัตราส่วนปริมาณ เรียนรู้การจำแนกตลาดเป็น 2 ช่วง — สถานะที่มีผลตอบแทนเฉลี่ยสูงกว่าเรียกว่า "bull" อีกสถานะคือ "bear" โมเดลถูกฝึก 200 รอบด้วย random seed คงที่ (42) เพื่อความสามารถทำซ้ำ ต้องการข้อมูลอย่างน้อย 60 แท่ง',
  },
  faqCooldown: { en: "How does the cooldown prevent whipsaw trades?", th: "Cooldown ป้องกัน whipsaw ได้อย่างไร?" },
  faqCooldownAnswer: {
    en: "After exiting a trade, the engine enforces a waiting period (2-3 bars depending on strategy) before allowing a new entry. Without cooldowns, rapid buy/sell cycles can occur when indicators fluctuate near their thresholds, generating many small losing trades that erode capital through transaction costs and slippage.",
    th: "หลังจากออกจากเทรด เครื่องมือจะบังคับช่วงรอ (2-3 แท่งขึ้นอยู่กับกลยุทธ์) ก่อนอนุญาตให้เข้าเทรดใหม่ หากไม่มี cooldown การซื้อ/ขายรวดเร็วอาจเกิดขึ้นเมื่อตัวชี้วัดผันผวนใกล้เกณฑ์ สร้างเทรดขาดทุนเล็กๆ จำนวนมากที่กัดกร่อนเงินทุนผ่านค่าธรรมเนียมและ slippage",
  },
  faqSplits: { en: "What's the difference between the train, validation, and test splits?", th: "ข้อมูลส่วน train, validation, และ test ต่างกันอย่างไร?" },
  faqSplitsAnswer: {
    en: '<strong class="text-foreground">Train (60%):</strong> The model learns patterns from this data. <strong class="text-foreground">Validation (20%):</strong> Used to rank and select the best variant — the validation_score determines the winner. <strong class="text-foreground">Test (20%):</strong> Held out entirely — used only to show how the winner performs on completely unseen data, giving you a realistic estimate of future performance.',
    th: '<strong class="text-foreground">Train (60%):</strong> โมเดลเรียนรู้รูปแบบจากข้อมูลนี้ <strong class="text-foreground">Validation (20%):</strong> ใช้จัดอันดับและเลือกรูปแบบที่ดีที่สุด — validation_score กำหนดผู้ชนะ <strong class="text-foreground">Test (20%):</strong> แยกออกทั้งหมด — ใช้เพื่อแสดงว่าผู้ชนะทำงานอย่างไรกับข้อมูลที่ไม่เคยเห็น ให้การประเมินประสิทธิภาพในอนาคตที่สมจริง',
  },
  faqTimeframes: { en: "What timeframes are supported?", th: "รองรับไทม์เฟรมอะไรบ้าง?" },
  faqTimeframesAnswer: {
    en: 'The platform supports: <strong class="text-foreground">1m, 2m, 5m, 15m, 30m</strong> (intraday), <strong class="text-foreground">1h, 2h, 3h, 4h</strong> (hourly), <strong class="text-foreground">1d, 1wk, 1mo</strong> (daily+). Note: 2h, 3h, and 4h are resampled from 1-hour data since yfinance doesn\'t support them natively.',
    th: 'แพลตฟอร์มรองรับ: <strong class="text-foreground">1m, 2m, 5m, 15m, 30m</strong> (อินทราเดย์), <strong class="text-foreground">1h, 2h, 3h, 4h</strong> (รายชั่วโมง), <strong class="text-foreground">1d, 1wk, 1mo</strong> (รายวัน+) หมายเหตุ: 2h, 3h, และ 4h ถูก resample จากข้อมูล 1 ชั่วโมงเนื่องจาก yfinance ไม่รองรับโดยตรง',
  },
  faqBrokerSafe: { en: "Are broker credentials safe?", th: "ข้อมูลโบรกเกอร์ปลอดภัยหรือไม่?" },
  faqBrokerSafeAnswer: {
    en: 'Broker API keys are encrypted with <strong class="text-foreground">Fernet symmetric encryption</strong> and only decrypted in-memory at execution time. They are <strong class="text-foreground">never returned in API responses</strong> — the frontend never sees the raw keys after submission. All credentials are scoped to the authenticated user.',
    th: 'คีย์ API โบรกเกอร์ถูกเข้ารหัสด้วย <strong class="text-foreground">Fernet symmetric encryption</strong> และถูกถอดรหัสในหน่วยความจำเฉพาะตอนดำเนินการ <strong class="text-foreground">ไม่เคยถูกส่งกลับใน API responses</strong> — frontend ไม่เห็นคีย์จริงหลังจากส่ง ข้อมูลทั้งหมดถูกจำกัดเฉพาะผู้ใช้ที่ยืนยันตัวตนแล้ว',
  },
  faqFvg: { en: "What is a Fair Value Gap (FVG)?", th: "Fair Value Gap (FVG) คืออะไร?" },
  faqFvgAnswer: {
    en: 'A Fair Value Gap is a price imbalance that occurs when a strong candle creates a gap between the high of candle N-2 and the low of candle N. <span class="text-[#26a69a]">Bullish FVGs</span> form when price gaps up (potential support zone). <span class="text-[#ef5350]">Bearish FVGs</span> form when price gaps down (potential resistance zone). You can view auto-detected FVGs on the dashboard chart using the "Auto FVG" button.',
    th: 'Fair Value Gap คือความไม่สมดุลของราคาที่เกิดขึ้นเมื่อแท่งเทียนที่แข็งแกร่งสร้างช่องว่างระหว่างจุดสูงสุดของแท่ง N-2 กับจุดต่ำสุดของแท่ง N <span class="text-[#26a69a]">FVG ขาขึ้น</span> เกิดเมื่อราคากระโดดขึ้น (โซนแนวรับที่เป็นไปได้) <span class="text-[#ef5350]">FVG ขาลง</span> เกิดเมื่อราคากระโดดลง (โซนแนวต้านที่เป็นไปได้) คุณสามารถดู FVG ที่ตรวจจับอัตโนมัติบนกราฟ dashboard โดยใช้ปุ่ม "Auto FVG"',
  },

  // ─── Opportunities & Scanner Section ──────────────────────────────────────
  sectionOpportunities: { en: "Opportunities & Live Scanner", th: "โอกาส & สแกนเนอร์สด" },
  opportunitiesDesc: {
    en: 'The <strong class="text-foreground">Opportunities</strong> page combines your personal watchlist with a live scanner that evaluates stocks every 5 minutes during market hours. When <strong class="text-foreground">all 10 conditions pass simultaneously</strong>, the ticker displays a pulsing green "STRONG BUY" badge. This is not a guarantee — it indicates a historically favorable entry zone with high confidence.',
    th: 'หน้า <strong class="text-foreground">Opportunities</strong> รวมรายการเฝ้าดูส่วนตัวกับสแกนเนอร์สดที่ประเมินหุ้นทุก 5 นาทีในช่วงเวลาตลาด เมื่อ<strong class="text-foreground">เงื่อนไขทั้ง 10 ผ่านพร้อมกัน</strong> ตัวหุ้นจะแสดงป้าย "STRONG BUY" สีเขียวกะพริบ นี่ไม่ใช่การรับประกัน — แต่บ่งชี้ว่าเป็นโซนเข้าที่เอื้ออำนวยในเชิงประวัติศาสตร์ด้วยความเชื่อมั่นสูง',
  },
  tenConditionsTitle: { en: "The 10-Condition Gate (ALL must pass)", th: "เกณฑ์ 10 เงื่อนไข (ต้องผ่านทั้งหมด)" },
  condPriceInZone: { en: "Price is within the calculated buy zone", th: "ราคาอยู่ในโซนซื้อที่คำนวณ" },
  condAbove50dMa: { en: "Price above 50-day moving average", th: "ราคาเหนือเส้นค่าเฉลี่ย 50 วัน" },
  condAbove200dMa: { en: "Price above 200-day moving average", th: "ราคาเหนือเส้นค่าเฉลี่ย 200 วัน" },
  condRsi: { en: "RSI between 30-55 (not overbought, not deeply oversold)", th: "RSI อยู่ระหว่าง 30-55 (ไม่ overbought ไม่ oversold มากเกินไป)" },
  condVolume: { en: "Volume declining on pullback (healthy consolidation)", th: "ปริมาณลดลงขณะ pullback (การรวมตัวที่ดี)" },
  condSupport: { en: "Price near support level", th: "ราคาใกล้แนวรับ" },
  condHmm: { en: "HMM regime is not bearish", th: "HMM ไม่อยู่ในช่วงขาลง" },
  condConfidence: { en: "Confidence score >= 65%", th: "คะแนนความเชื่อมั่น >= 65%" },
  condEarnings: { en: "Not near an earnings date", th: "ไม่ใกล้วันประกาศผลประกอบการ" },
  condCooldown: { en: "No duplicate signal in the last 4 hours", th: "ไม่มีสัญญาณซ้ำใน 4 ชั่วโมงล่าสุด" },
  watchlistSidebarTitle: { en: "Watchlist Sidebar", th: "แถบด้านข้างรายการเฝ้าดู" },
  watchlistSidebarDesc: {
    en: 'The right sidebar syncs with the Dashboard watchlist via localStorage. Add tickers to Indices, Stocks, Crypto, or Custom categories. Changes appear on both pages instantly.',
    th: 'แถบด้านข้างขวาซิงค์กับรายการเฝ้าดูของ Dashboard ผ่าน localStorage เพิ่มตัวหุ้นในหมวดดัชนี หุ้น คริปโต หรือกำหนดเอง การเปลี่ยนแปลงจะปรากฏบนทั้งสองหน้าทันที',
  },
  scanNowTitle: { en: "Scan Now", th: "สแกนตอนนี้" },
  scanNowDesc: {
    en: 'Click "Scan Now" to manually trigger the scanner outside of market hours. During market hours, the scanner runs automatically every 5 minutes.',
    th: 'คลิก "Scan Now" เพื่อเรียกใช้สแกนเนอร์ด้วยตนเองนอกเวลาตลาด ในช่วงเวลาตลาด สแกนเนอร์จะทำงานอัตโนมัติทุก 5 นาที',
  },

  // ─── Ideas Section ────────────────────────────────────────────────────────
  sectionIdeas: { en: "Ideas & Market Research", th: "ไอเดีย & วิจัยตลาด" },
  ideasDesc: {
    en: 'The <strong class="text-foreground">Ideas</strong> page has three tabs: <strong class="text-foreground">Market Pulse</strong> (live screener data + Reddit social sentiment), <strong class="text-foreground">AI Suggestions</strong> (auto-generated by the scanner engine), and <strong class="text-foreground">My Ideas</strong> (your personal investment theses).',
    th: 'หน้า <strong class="text-foreground">Ideas</strong> มีสามแท็บ: <strong class="text-foreground">Market Pulse</strong> (ข้อมูลตัวกรองสด + ความรู้สึกจาก Reddit), <strong class="text-foreground">AI Suggestions</strong> (สร้างอัตโนมัติโดยเครื่องมือสแกน), และ <strong class="text-foreground">My Ideas</strong> (ทฤษฎีการลงทุนส่วนตัวของคุณ)',
  },
  marketPulseTitle: { en: "Market Pulse (Live Data)", th: "Market Pulse (ข้อมูลสด)" },
  marketPulseDesc: {
    en: 'The default tab aggregates real-time data from two sources to surface actionable research starting points:',
    th: 'แท็บเริ่มต้นรวมข้อมูลแบบเรียลไทม์จากสองแหล่งเพื่อแสดงจุดเริ่มต้นการวิจัยที่นำไปปฏิบัติได้:',
  },
  redditTrendingTitle: { en: "Reddit Trending", th: "Reddit กำลังมาแรง" },
  redditTrendingDesc: {
    en: 'Scans hot posts from <strong class="text-foreground">r/wallstreetbets</strong>, <strong class="text-foreground">r/stocks</strong>, and <strong class="text-foreground">r/investing</strong> for ticker mentions ($AAPL, NVDA, etc.). Shows mention count, sentiment (bullish/bearish/mixed), and top discussion posts with direct links. Data refreshes every 5 minutes.',
    th: 'สแกนโพสต์ยอดนิยมจาก <strong class="text-foreground">r/wallstreetbets</strong>, <strong class="text-foreground">r/stocks</strong>, และ <strong class="text-foreground">r/investing</strong> เพื่อค้นหาการกล่าวถึงหุ้น ($AAPL, NVDA เป็นต้น) แสดงจำนวนการกล่าวถึง ความรู้สึก (bullish/bearish/mixed) และโพสต์สนทนายอดนิยมพร้อมลิงก์ ข้อมูลรีเฟรชทุก 5 นาที',
  },
  screenerSectionsTitle: { en: "TradingView Screener Sections", th: "ส่วนตัวกรอง TradingView" },
  screenerSectionsDesc: {
    en: 'Three collapsible sections powered by TradingView screener presets: <strong class="text-foreground">Quality Growth</strong> (high ROE, earnings growth, above moving averages), <strong class="text-foreground">Momentum Leaders</strong> (strong 1M/3M performance, high relative strength), and <strong class="text-foreground">Value Opportunities</strong> (low P/E, attractive valuations). Each stock shows price, change, RSI, P/E, volume, and quick links to Chart and TA.',
    th: 'สามส่วนที่ยุบได้ขับเคลื่อนโดย TradingView screener presets: <strong class="text-foreground">Quality Growth</strong> (ROE สูง กำไรเติบโต เหนือค่าเฉลี่ย), <strong class="text-foreground">Momentum Leaders</strong> (ผลตอบแทน 1M/3M แข็งแกร่ง), และ <strong class="text-foreground">Value Opportunities</strong> (P/E ต่ำ มูลค่าน่าสนใจ) แต่ละหุ้นแสดงราคา การเปลี่ยนแปลง RSI P/E ปริมาณ และลิงก์ด่วนไปยังกราฟและ TA',
  },
  suggestedIdeasTitle: { en: "AI Suggestions (Auto-Generated)", th: "AI แนะนำ (สร้างอัตโนมัติ)" },
  suggestedIdeasDesc: {
    en: 'Every hour during market hours, the engine scans ~50 stocks across three sources: <strong class="text-foreground">News</strong> (RSS feeds for catalysts), <strong class="text-foreground">Theme</strong> (megatrend/moat screening), and <strong class="text-foreground">Technical</strong> (pullback setups). Each idea is scored using a 6-component formula:',
    th: 'ทุกชั่วโมงในช่วงเวลาตลาด เครื่องมือจะสแกนหุ้น ~50 ตัวจาก 3 แหล่ง: <strong class="text-foreground">News</strong> (RSS feeds สำหรับตัวเร่ง), <strong class="text-foreground">Theme</strong> (คัดกรอง megatrend/moat), และ <strong class="text-foreground">Technical</strong> (รูปแบบ pullback) แต่ละไอเดียถูกให้คะแนนด้วยสูตร 6 องค์ประกอบ:',
  },
  ideaScoreFormula: {
    en: 'idea_score = confidence (25%) + megatrend_fit (20%) + moat (15%) + financial_quality (15%) + technical_setup (15%) + news_relevance (10%) + entry priority boosts',
    th: 'idea_score = ความเชื่อมั่น (25%) + megatrend_fit (20%) + moat (15%) + คุณภาพการเงิน (15%) + เทคนิค (15%) + ข่าว (10%) + โบนัสลำดับความสำคัญ',
  },
  entryPriorityTitle: { en: "Entry Priority Boosts", th: "โบนัสลำดับความสำคัญในการเข้า" },
  entryPriorityDesc: {
    en: 'Tickers near their <strong class="text-foreground">52-week low (+15%)</strong> or at <strong class="text-foreground">weekly support (+10%)</strong> receive an additive bonus to their idea score, capped at 1.0.',
    th: 'หุ้นที่ใกล้ <strong class="text-foreground">จุดต่ำสุด 52 สัปดาห์ (+15%)</strong> หรืออยู่ที่ <strong class="text-foreground">แนวรับรายสัปดาห์ (+10%)</strong> จะได้รับโบนัสเพิ่มในคะแนนไอเดีย จำกัดที่ 1.0',
  },
  ideaCardTitle: { en: "What Each Idea Card Shows", th: "การ์ดไอเดียแสดงอะไรบ้าง" },
  ideaCardDesc: {
    en: 'Each card displays: ticker, company name, overall score, theme/megatrend badges, entry priority badges (amber), why the stock was flagged, current price + buy zone + ideal entry, competitive moat rating, financial quality assessment, confidence score, 90-day historical win rate, and actions (Add to Watchlist, View Chart).',
    th: 'แต่ละการ์ดแสดง: ตัวหุ้น ชื่อบริษัท คะแนนรวม ป้ายธีม/megatrend ป้ายลำดับความสำคัญ (สีเหลืองอำพัน) เหตุผลที่ถูกเลือก ราคาปัจจุบัน + โซนซื้อ + จุดเข้าอุดมคติ การประเมิน moat คุณภาพการเงิน คะแนนความเชื่อมั่น อัตราชนะ 90 วัน และปุ่ม (เพิ่มในรายการเฝ้าดู ดูกราฟ)',
  },
  myIdeasTitle: { en: "My Ideas (Personal Theses)", th: "ไอเดียของฉัน (ทฤษฎีส่วนตัว)" },
  myIdeasDesc: {
    en: 'Create your own investment ideas with a title, thesis, conviction score (1-10), theme tags, linked tickers, and watch-only/tradable toggles. Ideas are ranked by a composite score combining your conviction level with technical analysis of linked tickers.',
    th: 'สร้างไอเดียการลงทุนของคุณเองด้วยชื่อ ทฤษฎี คะแนนความเชื่อมั่น (1-10) แท็กธีม ตัวหุ้นที่เชื่อมต่อ และสวิตช์ดูอย่างเดียว/ซื้อขายได้ ไอเดียถูกจัดอันดับตามคะแนนรวมที่รวมระดับความเชื่อมั่นกับการวิเคราะห์ทางเทคนิคของตัวหุ้นที่เชื่อมต่อ',
  },
  filterTabsTitle: { en: "Filter Tabs & Theme Chips", th: "แท็บตัวกรอง & ชิปธีม" },
  filterTabsDesc: {
    en: 'Filter suggested ideas by source (All / News / Theme / Technical) using the tabs. Narrow further by clicking theme chips: AI, Energy, Defense, Space, Semiconductors, Longevity, Robotics, Bitcoin, Healthcare, Medicine.',
    th: 'กรองไอเดียแนะนำตามแหล่ง (ทั้งหมด / ข่าว / ธีม / เทคนิค) โดยใช้แท็บ กรองเพิ่มเติมโดยคลิกชิปธีม: AI, Energy, Defense, Space, Semiconductors, Longevity, Robotics, Bitcoin, Healthcare, Medicine',
  },

  // ─── Alerts Section ───────────────────────────────────────────────────────
  sectionAlerts: { en: "Price Alerts", th: "การแจ้งเตือนราคา" },
  alertsDesc: {
    en: 'The <strong class="text-foreground">Alerts</strong> page lets you create custom price alerts for any ticker. Alerts are evaluated by the backend scheduler and fire when conditions are met during market hours.',
    th: 'หน้า <strong class="text-foreground">Alerts</strong> ให้คุณสร้างการแจ้งเตือนราคาสำหรับตัวหุ้นใดก็ได้ การแจ้งเตือนถูกประเมินโดย scheduler ของ backend และจะทำงานเมื่อเงื่อนไขตรงในช่วงเวลาตลาด',
  },
  alertTypesTitle: { en: "Alert Types", th: "ประเภทการแจ้งเตือน" },
  alertTypeAbove: { en: "Price crosses above a threshold", th: "ราคาข้ามเหนือเกณฑ์" },
  alertTypeBelow: { en: "Price drops below a threshold", th: "ราคาต่ำกว่าเกณฑ์" },
  alertTypeBuyZone: { en: "Ticker enters its calculated buy zone", th: "หุ้นเข้าสู่โซนซื้อที่คำนวณ" },
  alertTypeTheme: { en: "Theme score changes significantly", th: "คะแนนธีมเปลี่ยนแปลงอย่างมีนัยสำคัญ" },
  alertCooldownTitle: { en: "Alert Cooldown", th: "ช่วงพักการแจ้งเตือน" },
  alertCooldownDesc: {
    en: 'Each alert has a configurable cooldown period (default 240 minutes / 4 hours). After firing, the same alert will not trigger again until the cooldown expires. This prevents notification spam during volatile periods.',
    th: 'แต่ละการแจ้งเตือนมีช่วงพักที่ปรับได้ (ค่าเริ่มต้น 240 นาที / 4 ชั่วโมง) หลังจากทำงาน การแจ้งเตือนเดียวกันจะไม่ทริกเกอร์อีกจนกว่า cooldown จะหมด ป้องกันการแจ้งเตือนซ้ำในช่วงที่ผันผวน',
  },
  alertMarketHoursTitle: { en: "Market Hours Only", th: "เฉพาะเวลาตลาดเท่านั้น" },
  alertMarketHoursDesc: {
    en: 'Alerts can be restricted to market hours only (9:30 AM - 4:00 PM ET, weekdays). Enable this to avoid false signals from low-liquidity after-hours price moves.',
    th: 'การแจ้งเตือนสามารถจำกัดเฉพาะเวลาตลาด (9:30 - 16:00 ET วันจันทร์-ศุกร์) เปิดใช้เพื่อหลีกเลี่ยงสัญญาณเท็จจากการเคลื่อนไหวราคานอกเวลาที่สภาพคล่องต่ำ',
  },

  // ─── Auto-Buy Section ─────────────────────────────────────────────────────
  sectionAutoBuy: { en: "Auto-Buy Engine", th: "เครื่องมือซื้ออัตโนมัติ" },
  autoBuyDesc: {
    en: 'The <strong class="text-foreground">Auto-Buy</strong> feature automates order execution when your watchlist tickers hit their buy zones. It runs as a scheduled background job and follows strict safety rules to protect your capital.',
    th: '<strong class="text-foreground">Auto-Buy</strong> ทำการสั่งซื้ออัตโนมัติเมื่อตัวหุ้นในรายการเฝ้าดูเข้าสู่โซนซื้อ ทำงานเป็น background job และปฏิบัติตามกฎความปลอดภัยอย่างเคร่งครัดเพื่อปกป้องเงินทุน',
  },
  autoBuySafetyTitle: { en: "Safety Rules", th: "กฎความปลอดภัย" },
  autoBuySafety1: {
    en: '<strong class="text-foreground">Dry-run by default</strong> — Auto-buy starts in simulation mode. You must explicitly enable live execution.',
    th: '<strong class="text-foreground">จำลองเป็นค่าเริ่มต้น</strong> — Auto-buy เริ่มในโหมดจำลอง ต้องเปิดใช้การดำเนินการจริงด้วยตนเอง',
  },
  autoBuySafety2: {
    en: '<strong class="text-foreground">Position size limit</strong> — Maximum dollar amount per order is capped by your settings.',
    th: '<strong class="text-foreground">จำกัดขนาดตำแหน่ง</strong> — จำนวนเงินสูงสุดต่อคำสั่งถูกจำกัดตามการตั้งค่าของคุณ',
  },
  autoBuySafety3: {
    en: '<strong class="text-foreground">Broker account whitelist</strong> — Only allowed broker accounts can execute trades.',
    th: '<strong class="text-foreground">รายชื่อบัญชีที่อนุญาต</strong> — เฉพาะบัญชีโบรกเกอร์ที่อนุญาตเท่านั้นที่สามารถดำเนินการซื้อขาย',
  },
  autoBuySafety4: {
    en: '<strong class="text-foreground">Cooldown between orders</strong> — Prevents rapid-fire duplicate purchases on the same ticker.',
    th: '<strong class="text-foreground">ช่วงพักระหว่างคำสั่ง</strong> — ป้องกันการซื้อซ้ำเร็วเกินไปบนตัวหุ้นเดียวกัน',
  },
  dryRunTitle: { en: "Dry-Run Mode", th: "โหมดจำลอง" },
  dryRunDesc: {
    en: 'Use the <strong class="text-foreground">Dry Run</strong> button to simulate what the auto-buy engine would do for any ticker — it shows whether a buy would be triggered, at what price, and the reasons behind the decision — without placing a real order.',
    th: 'ใช้ปุ่ม <strong class="text-foreground">Dry Run</strong> เพื่อจำลองว่า auto-buy จะทำอะไรสำหรับตัวหุ้นใดๆ — แสดงว่าจะซื้อหรือไม่ ที่ราคาเท่าไร และเหตุผลเบื้องหลังการตัดสินใจ — โดยไม่วางคำสั่งจริง',
  },
  decisionLogTitle: { en: "Decision Log", th: "บันทึกการตัดสินใจ" },
  decisionLogDesc: {
    en: 'Every auto-buy decision (both executed and skipped) is logged with a timestamp, ticker, price, reason codes, and whether it was a dry run. Review the log to understand why trades were or were not executed.',
    th: 'ทุกการตัดสินใจ auto-buy (ทั้งดำเนินการและข้าม) ถูกบันทึกด้วยเวลา ตัวหุ้น ราคา รหัสเหตุผล และว่าเป็น dry run หรือไม่ ตรวจสอบบันทึกเพื่อเข้าใจว่าทำไมเทรดถูกดำเนินการหรือไม่',
  },

  // ─── Screener & TA Section ────────────────────────────────────────────────
  sectionScreenerTA: { en: "Screener & Technical Analysis", th: "ตัวกรองหุ้น & การวิเคราะห์ทางเทคนิค" },
  screenerTADesc: {
    en: 'The <strong class="text-foreground">Screener & TA</strong> page combines a market screener with instant technical analysis. Scan stocks, crypto, forex, or ETFs using filters, then click any result to see a full indicator breakdown with buy/sell/neutral signals.',
    th: 'หน้า <strong class="text-foreground">Screener & TA</strong> รวมตัวกรองตลาดกับการวิเคราะห์ทางเทคนิคแบบทันที สแกนหุ้น, คริปโต, ฟอเร็กซ์ หรือ ETF โดยใช้ตัวกรอง จากนั้นคลิกผลลัพธ์เพื่อดูรายละเอียดตัวชี้วัดพร้อมสัญญาณซื้อ/ขาย/เป็นกลาง',
  },
  screenerWorkflowTitle: { en: "How It Works", th: "วิธีการทำงาน" },
  screenerStep1: {
    en: '<strong class="text-foreground">Choose a market</strong> — Select Stocks, Crypto, Forex, or ETFs from the market selector buttons.',
    th: '<strong class="text-foreground">เลือกตลาด</strong> — เลือก Stocks, Crypto, Forex หรือ ETFs จากปุ่มเลือกตลาด',
  },
  screenerStep2: {
    en: '<strong class="text-foreground">Set filters</strong> — Optionally set min/max price, min volume, sort field, and number of results. Or use a Quick Preset for stocks.',
    th: '<strong class="text-foreground">ตั้งค่าตัวกรอง</strong> — ตั้งค่าราคาขั้นต่ำ/สูงสุด ปริมาณขั้นต่ำ การเรียงลำดับ และจำนวนผลลัพธ์ หรือใช้ Quick Preset สำหรับหุ้น',
  },
  screenerStep3: {
    en: '<strong class="text-foreground">Scan Market</strong> — Click the scan button to fetch matching assets. Results show symbol, price, change %, volume, RSI, and a signal badge.',
    th: '<strong class="text-foreground">สแกนตลาด</strong> — คลิกปุ่มสแกนเพื่อค้นหาสินทรัพย์ ผลลัพธ์แสดงสัญลักษณ์ ราคา เปลี่ยนแปลง% ปริมาณ RSI และป้ายสัญญาณ',
  },
  screenerStep4: {
    en: '<strong class="text-foreground">Select an asset</strong> — Click any row to load its technical analysis in the right panel. The selected row is highlighted.',
    th: '<strong class="text-foreground">เลือกสินทรัพย์</strong> — คลิกแถวเพื่อโหลดการวิเคราะห์ทางเทคนิคในแผงด้านขวา แถวที่เลือกจะถูกไฮไลต์',
  },
  screenerStep5: {
    en: '<strong class="text-foreground">Review TA</strong> — See the overall recommendation (Strong Buy to Strong Sell), a buy/neutral/sell gauge, oscillator values (RSI, MACD, Stochastic), moving averages (EMA/SMA), and volume confirmation.',
    th: '<strong class="text-foreground">ตรวจสอบ TA</strong> — ดูคำแนะนำรวม (Strong Buy ถึง Strong Sell) มาตรวัดซื้อ/เป็นกลาง/ขาย ค่าออสซิลเลเตอร์ (RSI, MACD, Stochastic) ค่าเฉลี่ยเคลื่อนที่ (EMA/SMA) และการยืนยันปริมาณ',
  },
  screenerPresetsTitle: { en: "Quick Presets (Stocks)", th: "Quick Presets (หุ้น)" },
  screenerPresetsDesc: {
    en: 'For stocks, preset filters are available: <strong class="text-foreground">Quality</strong> (low-volatility, stable), <strong class="text-foreground">Value</strong> (low P/E and P/B), <strong class="text-foreground">Dividend</strong> (high yield), <strong class="text-foreground">Momentum</strong> (strong recent performance), and <strong class="text-foreground">Growth</strong> (expanding revenue/earnings). Click any preset badge to instantly apply its filters.',
    th: 'สำหรับหุ้น มีตัวกรองสำเร็จรูป: <strong class="text-foreground">Quality</strong> (ความผันผวนต่ำ มั่นคง), <strong class="text-foreground">Value</strong> (P/E และ P/B ต่ำ), <strong class="text-foreground">Dividend</strong> (อัตราผลตอบแทนสูง), <strong class="text-foreground">Momentum</strong> (ผลตอบแทนล่าสุดแข็งแกร่ง), และ <strong class="text-foreground">Growth</strong> (รายได้เติบโต) คลิกป้าย preset เพื่อใช้ตัวกรองทันที',
  },
  screenerTimeframesTitle: { en: "Timeframe Switching", th: "การเปลี่ยนกรอบเวลา" },
  screenerTimeframesDesc: {
    en: 'After selecting an asset, switch timeframes (15m, 1H, 4H, 1D, 1W) in the TA panel. Each timeframe re-evaluates all indicators independently, so a stock might show "Buy" on the daily but "Sell" on 15-minute.',
    th: 'หลังจากเลือกสินทรัพย์ เปลี่ยนกรอบเวลา (15m, 1H, 4H, 1D, 1W) ในแผง TA แต่ละกรอบเวลาประเมินตัวชี้วัดทั้งหมดใหม่อย่างอิสระ ดังนั้นหุ้นอาจแสดง "Buy" บนกรอบรายวันแต่ "Sell" บน 15 นาที',
  },
  screenerAnalystTitle: { en: "Analyst Summary", th: "สรุปจากนักวิเคราะห์" },
  screenerAnalystDesc: {
    en: 'Below the TA panel, a summary explains why the asset appeared in the screener and what the indicators currently suggest. The setup is described as Bullish, Moderately Bullish, Mixed, Moderately Bearish, or Bearish based on indicator consensus.',
    th: 'ด้านล่างแผง TA สรุปอธิบายว่าทำไมสินทรัพย์ปรากฏในตัวกรองและตัวชี้วัดแนะนำอะไร สถานะอธิบายเป็น Bullish, Moderately Bullish, Mixed, Moderately Bearish หรือ Bearish ตามฉันทามติของตัวชี้วัด',
  },

  // ─── New FAQ items ────────────────────────────────────────────────────────
  faqOpportunities: { en: "How do I use the Opportunities page?", th: "ใช้หน้า Opportunities อย่างไร?" },
  faqOpportunitiesAnswer: {
    en: 'Add tickers to your scanner watchlist using the input at the top of the table. The scanner evaluates each ticker every 5 minutes during market hours against 10 conditions. When all pass, you see a green <strong class="text-foreground">STRONG BUY</strong> badge. Click any row to expand and see the entry zone details. The right sidebar is your personal watchlist synced with the Dashboard.',
    th: 'เพิ่มตัวหุ้นในรายการเฝ้าดูของสแกนเนอร์โดยใช้ช่องป้อนข้อมูลด้านบนตาราง สแกนเนอร์ประเมินตัวหุ้นแต่ละตัวทุก 5 นาทีในช่วงเวลาตลาดเทียบกับ 10 เงื่อนไข เมื่อผ่านทั้งหมด คุณจะเห็นป้าย <strong class="text-foreground">STRONG BUY</strong> สีเขียว คลิกแถวเพื่อดูรายละเอียดโซนเข้า แถบด้านข้างขวาคือรายการเฝ้าดูส่วนตัวที่ซิงค์กับ Dashboard',
  },
  faqIdeasScan: { en: "How do I generate idea suggestions?", th: "สร้างไอเดียแนะนำอย่างไร?" },
  faqIdeasScanAnswer: {
    en: 'Go to the Ideas page, <strong class="text-foreground">AI Suggestions</strong> tab. Click <strong class="text-foreground">Scan Now</strong> to trigger an immediate scan, or wait for the automatic hourly scan during market hours. The engine scans ~50 stocks across news, themes, and technicals, then ranks them by idea score. Click <strong class="text-foreground">Add to Watchlist</strong> on any card to track it on the Opportunities page.',
    th: 'ไปที่หน้า Ideas แท็บ <strong class="text-foreground">AI Suggestions</strong> คลิก <strong class="text-foreground">Scan Now</strong> เพื่อเรียกใช้สแกนทันที หรือรอการสแกนอัตโนมัติรายชั่วโมงในช่วงเวลาตลาด เครื่องมือสแกนหุ้น ~50 ตัวจากข่าว ธีม และเทคนิค จากนั้นจัดอันดับตาม idea score คลิก <strong class="text-foreground">Add to Watchlist</strong> บนการ์ดเพื่อติดตามบนหน้า Opportunities',
  },
  faqMarketPulse: { en: "What is Market Pulse and where does the data come from?", th: "Market Pulse คืออะไร และข้อมูลมาจากไหน?" },
  faqMarketPulseAnswer: {
    en: 'Market Pulse is the default tab on the Ideas page. It combines two free data sources: <strong class="text-foreground">Reddit social sentiment</strong> (scans r/wallstreetbets, r/stocks, r/investing for trending tickers) and <strong class="text-foreground">TradingView screener data</strong> (quality growth, momentum, and value stock screens). It refreshes every 5-10 minutes. Social sentiment shows mention counts and bullish/bearish classification — use it as a starting point, not as trading advice.',
    th: 'Market Pulse เป็นแท็บเริ่มต้นในหน้า Ideas รวมข้อมูลจากสองแหล่งฟรี: <strong class="text-foreground">ความรู้สึกจาก Reddit</strong> (สแกน r/wallstreetbets, r/stocks, r/investing สำหรับหุ้นที่กำลังเป็นที่พูดถึง) และ <strong class="text-foreground">ข้อมูลตัวกรอง TradingView</strong> (quality growth, momentum และ value) รีเฟรชทุก 5-10 นาที ความรู้สึกแสดงจำนวนการกล่าวถึงและการจำแนก bullish/bearish — ใช้เป็นจุดเริ่มต้น ไม่ใช่คำแนะนำในการซื้อขาย',
  },
  faqRedditAccuracy: { en: "How accurate is Reddit social sentiment?", th: "ความรู้สึกจาก Reddit แม่นยำแค่ไหน?" },
  faqRedditAccuracyAnswer: {
    en: 'Reddit sentiment reflects <strong class="text-foreground">retail trader discussion</strong>, not institutional analysis. A ticker being heavily mentioned on r/wallstreetbets may indicate high retail interest, but it does not guarantee price movement. The sentiment labels (bullish/bearish/mixed) are based on keyword analysis of post titles and text. Always cross-reference with technical analysis and fundamentals before making decisions.',
    th: 'ความรู้สึกจาก Reddit สะท้อน<strong class="text-foreground">การสนทนาของนักเทรดรายย่อย</strong> ไม่ใช่การวิเคราะห์ของสถาบัน หุ้นที่ถูกกล่าวถึงมากใน r/wallstreetbets อาจบ่งบอกความสนใจของรายย่อยสูง แต่ไม่รับประกันการเคลื่อนไหวของราคา ป้ายความรู้สึก (bullish/bearish/mixed) อิงจากการวิเคราะห์คำสำคัญของหัวข้อและเนื้อหาโพสต์ ควรตรวจสอบกับการวิเคราะห์ทางเทคนิคและพื้นฐานก่อนตัดสินใจ',
  },
  faqAutoBuySafe: { en: "Is Auto-Buy safe? Can it buy without my permission?", th: "Auto-Buy ปลอดภัยหรือไม่? สามารถซื้อโดยไม่ได้รับอนุญาตหรือไม่?" },
  faqAutoBuySafeAnswer: {
    en: 'Auto-Buy defaults to <strong class="text-foreground">dry-run mode</strong> — it logs what it would do without placing real orders. You must explicitly enable live execution, set a position size limit, and whitelist specific broker accounts. Every decision is logged in the Decision Log for full transparency.',
    th: 'Auto-Buy ค่าเริ่มต้นเป็น<strong class="text-foreground">โหมดจำลอง</strong> — บันทึกว่าจะทำอะไรโดยไม่วางคำสั่งจริง คุณต้องเปิดใช้การดำเนินการจริง ตั้งค่าจำกัดขนาดตำแหน่ง และอนุญาตบัญชีโบรกเกอร์เฉพาะด้วยตนเอง ทุกการตัดสินใจถูกบันทึกใน Decision Log เพื่อความโปร่งใส',
  },
  faqAlertTypes: { en: "What types of price alerts can I create?", th: "สร้างการแจ้งเตือนราคาประเภทใดได้บ้าง?" },
  faqAlertTypesAnswer: {
    en: 'Four types: <strong class="text-foreground">price_above</strong> (crosses above), <strong class="text-foreground">price_below</strong> (drops below), <strong class="text-foreground">entered_buy_zone</strong> (ticker enters its calculated buy zone), and <strong class="text-foreground">theme_score_changed</strong> (significant theme score shift). Each has a configurable cooldown to prevent notification spam.',
    th: 'สี่ประเภท: <strong class="text-foreground">price_above</strong> (ข้ามเหนือ), <strong class="text-foreground">price_below</strong> (ต่ำกว่า), <strong class="text-foreground">entered_buy_zone</strong> (เข้าสู่โซนซื้อ), และ <strong class="text-foreground">theme_score_changed</strong> (คะแนนธีมเปลี่ยน) แต่ละประเภทมี cooldown ที่ปรับได้เพื่อป้องกันการแจ้งเตือนซ้ำ',
  },
  faqScreenerWhat: { en: "What is the Screener & TA page?", th: "หน้า Screener & TA คืออะไร?" },
  faqScreenerWhatAnswer: {
    en: 'The Screener & TA page is a two-in-one tool: a <strong class="text-foreground">market screener</strong> to find interesting assets across stocks, crypto, forex, and ETFs, combined with instant <strong class="text-foreground">technical analysis</strong> for any asset you select. Think of it as a radar for finding opportunities and quickly evaluating their technical setup.',
    th: 'หน้า Screener & TA เป็นเครื่องมือสองในหนึ่ง: <strong class="text-foreground">ตัวกรองตลาด</strong> เพื่อค้นหาสินทรัพย์ที่น่าสนใจในหุ้น คริปโต ฟอเร็กซ์ และ ETF รวมกับ <strong class="text-foreground">การวิเคราะห์ทางเทคนิค</strong> ทันทีสำหรับสินทรัพย์ที่คุณเลือก คิดเป็นเรดาร์สำหรับค้นหาโอกาสและประเมินสถานะทางเทคนิคอย่างรวดเร็ว',
  },
  faqScreenerMarkets: { en: "Which markets can I scan?", th: "สแกนตลาดไหนได้บ้าง?" },
  faqScreenerMarketsAnswer: {
    en: 'Four markets: <strong class="text-foreground">Stocks</strong> (US exchanges with sector/market cap data), <strong class="text-foreground">Crypto</strong> (major exchanges like Binance), <strong class="text-foreground">Forex</strong> (major currency pairs), and <strong class="text-foreground">ETFs</strong> (index and sector ETFs). Each market has different available filters and columns.',
    th: 'สี่ตลาด: <strong class="text-foreground">Stocks</strong> (ตลาดหุ้นสหรัฐพร้อมข้อมูลเซกเตอร์/มูลค่าตลาด), <strong class="text-foreground">Crypto</strong> (ตลาดหลักเช่น Binance), <strong class="text-foreground">Forex</strong> (คู่สกุลเงินหลัก), และ <strong class="text-foreground">ETFs</strong> (ดัชนีและ ETF เซกเตอร์) แต่ละตลาดมีตัวกรองและคอลัมน์ที่แตกต่างกัน',
  },
  faqScreenerTA: { en: "What indicators does the TA panel show?", th: "แผง TA แสดงตัวชี้วัดอะไรบ้าง?" },
  faqScreenerTAAnswer: {
    en: 'The TA panel shows <strong class="text-foreground">oscillators</strong> (RSI, MACD, Stochastic %K, CCI, ADX, Williams %R, Bull/Bear Power) and <strong class="text-foreground">moving averages</strong> (EMA 10/20/50, SMA 20/50/100/200). Each indicator shows its current value and a Buy/Sell/Neutral signal. A gauge bar visualizes the overall balance. Volume confirmation data is also shown when available.',
    th: 'แผง TA แสดง <strong class="text-foreground">ออสซิลเลเตอร์</strong> (RSI, MACD, Stochastic %K, CCI, ADX, Williams %R, Bull/Bear Power) และ <strong class="text-foreground">ค่าเฉลี่ยเคลื่อนที่</strong> (EMA 10/20/50, SMA 20/50/100/200) แต่ละตัวชี้วัดแสดงค่าปัจจุบันและสัญญาณ Buy/Sell/Neutral มาตรวัดแสดงสมดุลรวม ข้อมูลยืนยันปริมาณแสดงเมื่อมี',
  },
  // ── Broker Setup & API Keys ──────────────────────────────────────────────────
  sectionBrokerSetup: { en: "Broker Setup & API Keys", th: "การตั้งค่าโบรกเกอร์และ API Keys" },
  brokerSetupDesc: {
    en: 'NextGenStock connects to <strong class="text-foreground">Alpaca</strong> for live and paper trading. You need an Alpaca account and API keys to execute orders. This section walks you through the setup process.',
    th: 'NextGenStock เชื่อมต่อกับ <strong class="text-foreground">Alpaca</strong> สำหรับการซื้อขายจริงและจำลอง คุณต้องมีบัญชี Alpaca และ API keys เพื่อดำเนินการคำสั่งซื้อขาย ส่วนนี้จะแนะนำขั้นตอนการตั้งค่า',
  },
  brokerStepTitle: { en: "How to Get Your Alpaca API Keys", th: "วิธีรับ Alpaca API Keys ของคุณ" },
  brokerStep1: {
    en: 'Go to <strong class="text-foreground">alpaca.markets</strong> and click <strong class="text-foreground">Sign Up</strong>. Create a free account with your email.',
    th: 'ไปที่ <strong class="text-foreground">alpaca.markets</strong> แล้วคลิก <strong class="text-foreground">Sign Up</strong> สร้างบัญชีฟรีด้วยอีเมลของคุณ',
  },
  brokerStep2: {
    en: 'After logging in, navigate to the <strong class="text-foreground">Paper Trading</strong> dashboard (recommended to start with paper trading).',
    th: 'หลังจากเข้าสู่ระบบ ไปที่แดชบอร์ด <strong class="text-foreground">Paper Trading</strong> (แนะนำให้เริ่มด้วย paper trading)',
  },
  brokerStep3: {
    en: 'Click <strong class="text-foreground">API Keys</strong> in the left sidebar, then click <strong class="text-foreground">Generate New Key</strong>.',
    th: 'คลิก <strong class="text-foreground">API Keys</strong> ในแถบด้านซ้าย จากนั้นคลิก <strong class="text-foreground">Generate New Key</strong>',
  },
  brokerStep4: {
    en: 'Copy both the <strong class="text-foreground">API Key ID</strong> and <strong class="text-foreground">Secret Key</strong>. The secret is only shown once — save it securely.',
    th: 'คัดลอกทั้ง <strong class="text-foreground">API Key ID</strong> และ <strong class="text-foreground">Secret Key</strong> รหัสลับจะแสดงเพียงครั้งเดียว — บันทึกไว้อย่างปลอดภัย',
  },
  brokerAddTitle: { en: "Adding Keys to NextGenStock", th: "เพิ่ม Keys ใน NextGenStock" },
  brokerAddStep1: {
    en: 'Go to the <strong class="text-foreground">Profile</strong> page in NextGenStock (click your avatar → Profile).',
    th: 'ไปที่หน้า <strong class="text-foreground">Profile</strong> ใน NextGenStock (คลิกรูปโปรไฟล์ → Profile)',
  },
  brokerAddStep2: {
    en: 'Scroll to the <strong class="text-foreground">Broker Credentials</strong> section and click <strong class="text-foreground">Add Broker</strong>.',
    th: 'เลื่อนลงไปที่ส่วน <strong class="text-foreground">Broker Credentials</strong> แล้วคลิก <strong class="text-foreground">Add Broker</strong>',
  },
  brokerAddStep3: {
    en: 'Select <strong class="text-foreground">Alpaca</strong> as the broker, paste your API Key ID and Secret Key, then save.',
    th: 'เลือก <strong class="text-foreground">Alpaca</strong> เป็นโบรกเกอร์ วาง API Key ID และ Secret Key จากนั้นบันทึก',
  },
  brokerAddStep4: {
    en: 'A green <strong class="text-foreground">Connected</strong> badge will appear if the keys are valid. You can now trade from the Live Trading page.',
    th: 'ป้าย <strong class="text-foreground">Connected</strong> สีเขียวจะปรากฏหากคีย์ถูกต้อง คุณสามารถเทรดจากหน้า Live Trading ได้แล้ว',
  },
  brokerPaperVsLiveTitle: { en: "Paper vs Live Keys", th: "Paper Keys กับ Live Keys" },
  brokerPaperVsLiveDesc: {
    en: 'Alpaca provides <strong class="text-foreground">two environments</strong>: Paper (simulated, no real money) and Live (real brokerage). Each has its own API keys. We strongly recommend starting with <strong class="text-foreground">paper keys</strong> to test your strategies risk-free. When you\'re ready for real trading, generate live keys from Alpaca\'s Live Trading dashboard and update your credentials in NextGenStock.',
    th: 'Alpaca มี <strong class="text-foreground">สองสภาพแวดล้อม</strong>: Paper (จำลอง ไม่ใช้เงินจริง) และ Live (โบรกเกอร์จริง) แต่ละแบบมี API keys ของตัวเอง เราแนะนำอย่างยิ่งให้เริ่มด้วย <strong class="text-foreground">paper keys</strong> เพื่อทดสอบกลยุทธ์โดยไม่มีความเสี่ยง เมื่อพร้อมสำหรับการเทรดจริง สร้าง live keys จากแดชบอร์ด Live Trading ของ Alpaca และอัปเดต credentials ใน NextGenStock',
  },
  brokerSecurityTitle: { en: "Security & Key Storage", th: "ความปลอดภัยและการจัดเก็บคีย์" },
  brokerSecurityDesc: {
    en: 'Your API keys are <strong class="text-foreground">encrypted at rest</strong> using Fernet symmetric encryption. Keys are only decrypted in-memory at the moment of order execution and are <strong class="text-foreground">never returned in API responses</strong>. You can delete your credentials at any time from the Profile page.',
    th: 'API keys ของคุณ <strong class="text-foreground">เข้ารหัสขณะจัดเก็บ</strong> ด้วย Fernet symmetric encryption คีย์จะถูกถอดรหัสในหน่วยความจำเฉพาะเมื่อดำเนินการคำสั่งซื้อขายเท่านั้น และ <strong class="text-foreground">ไม่เคยส่งกลับใน API responses</strong> คุณสามารถลบ credentials ได้ตลอดเวลาจากหน้า Profile',
  },
  faqAlpacaFree: { en: "Is Alpaca free to use?", th: "Alpaca ใช้ฟรีหรือไม่?" },
  faqAlpacaFreeAnswer: {
    en: 'Yes. Alpaca offers <strong class="text-foreground">commission-free</strong> stock and ETF trading. There are no platform fees for API access. Paper trading is completely free with unlimited virtual funds. Live trading requires a funded brokerage account (no minimum for most account types).',
    th: 'ใช่ Alpaca ให้บริการซื้อขายหุ้นและ ETF <strong class="text-foreground">โดยไม่มีค่าคอมมิชชัน</strong> ไม่มีค่าธรรมเนียมแพลตฟอร์มสำหรับการเข้าถึง API Paper trading ฟรีโดยสมบูรณ์พร้อมเงินจำลองไม่จำกัด การเทรดจริงต้องมีบัญชีโบรกเกอร์ที่มีเงินทุน (ไม่มีขั้นต่ำสำหรับบัญชีส่วนใหญ่)',
  },
  faqAlpacaRegion: { en: "Which countries does Alpaca support?", th: "Alpaca รองรับประเทศไหนบ้าง?" },
  faqAlpacaRegionAnswer: {
    en: 'Alpaca supports US-based and international accounts. US residents get full brokerage access. International users can trade US stocks through Alpaca\'s global offering. Check <strong class="text-foreground">alpaca.markets/supported-countries</strong> for the latest list of supported regions.',
    th: 'Alpaca รองรับบัญชีในสหรัฐฯ และต่างประเทศ ผู้อยู่อาศัยในสหรัฐฯ ได้รับการเข้าถึงโบรกเกอร์เต็มรูปแบบ ผู้ใช้ต่างชาติสามารถซื้อขายหุ้นสหรัฐฯ ผ่านบริการระดับโลกของ Alpaca ตรวจสอบ <strong class="text-foreground">alpaca.markets/supported-countries</strong> สำหรับรายชื่อภูมิภาคที่รองรับล่าสุด',
  },
} as const;

export type TranslationKey = keyof typeof t;

/** Helper: get translated string for current language */
export function tr(key: TranslationKey, lang: Lang): string {
  return t[key][lang];
}
